import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function stripeFetch(path: string, apiKey: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });
  return { data: await res.json(), ok: res.ok, status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = getSupabase();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Stripe Webhook ──
    if (action === "webhook") {
      const payload = await req.text();
      const sigHeader = req.headers.get("stripe-signature");
      const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

      // For now, process without signature verification (add later for production)
      const event = JSON.parse(payload);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const amountCents = session.amount_total;

        if (userId && amountCents) {
          const { data: bal } = await supabase
            .from("balances")
            .select("balance_cents, total_deposited_cents")
            .eq("user_id", userId)
            .single();

          if (bal) {
            await supabase
              .from("balances")
              .update({
                balance_cents: bal.balance_cents + amountCents,
                total_deposited_cents: bal.total_deposited_cents + amountCents,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);
          }

          await supabase
            .from("transactions")
            .update({ status: "confirmed" })
            .eq("external_id", session.id);
        }
      }

      if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object;
        await supabase
          .from("transactions")
          .update({ status: "failed" })
          .eq("external_id", pi.id);
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Auth required ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create Checkout Session ──
    if (action === "create-checkout") {
      const { amount_cents, success_url, cancel_url } = await req.json();

      if (!amount_cents || amount_cents < 500) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo: R$ 5,00" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": "brl",
        "line_items[0][price_data][product_data][name]": `CodPilot - Crédito R$ ${(amount_cents / 100).toFixed(2)}`,
        "line_items[0][price_data][unit_amount]": amount_cents.toString(),
        "line_items[0][quantity]": "1",
        "metadata[user_id]": user.id,
        "metadata[amount_cents]": amount_cents.toString(),
        success_url: success_url || `${req.headers.get("origin") || ""}/?payment=success`,
        cancel_url: cancel_url || `${req.headers.get("origin") || ""}/?payment=cancelled`,
      });

      const { data: session, ok } = await stripeFetch(
        "/checkout/sessions",
        stripeKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }
      );

      if (!ok) {
        return new Response(
          JSON.stringify({ error: session.error?.message || "Stripe error" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount_cents,
        description: `Depósito Stripe R$ ${(amount_cents / 100).toFixed(2)}`,
        payment_method: "stripe_checkout",
        payment_gateway: "stripe",
        external_id: session.id,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ checkout_url: session.url, session_id: session.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Create Payment Intent (for embedded forms) ──
    if (action === "create-intent") {
      const { amount_cents } = await req.json();

      if (!amount_cents || amount_cents < 500) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo: R$ 5,00" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params = new URLSearchParams({
        amount: amount_cents.toString(),
        currency: "brl",
        "metadata[user_id]": user.id,
        "metadata[amount_cents]": amount_cents.toString(),
      });

      const { data: intent, ok } = await stripeFetch(
        "/payment_intents",
        stripeKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }
      );

      if (!ok) {
        return new Response(
          JSON.stringify({ error: intent.error?.message || "Stripe error" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount_cents,
        description: `Depósito Stripe R$ ${(amount_cents / 100).toFixed(2)}`,
        payment_method: "stripe_intent",
        payment_gateway: "stripe",
        external_id: intent.id,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ client_secret: intent.client_secret, intent_id: intent.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
