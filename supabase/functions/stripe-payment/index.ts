import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

function getStripe() {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
}

async function creditUserBalance(
  supabase: any,
  userId: string,
  amountCents: number,
  creditsAmount: number,
  externalId: string,
  description: string
) {
  const { data: bal } = await supabase
    .from("balances")
    .select("balance_cents, total_deposited_cents")
    .eq("user_id", userId)
    .single();

  if (!bal) return false;
  const b = bal as any;

  const finalCredits = creditsAmount > 0 ? creditsAmount : amountCents;

  await supabase.from("balances").update({
    balance_cents: b.balance_cents + finalCredits,
    total_deposited_cents: b.total_deposited_cents + amountCents,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await supabase.from("transactions").insert({
    user_id: userId,
    type: "deposit",
    amount_cents: amountCents,
    description,
    payment_method: "stripe",
    payment_gateway: "stripe",
    external_id: externalId,
    status: "confirmed",
  });

  // Comissão afiliado 30%
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .single();

  if (userProfile?.referred_by && userProfile.referred_by !== userId) {
    const commissionCents = Math.floor(amountCents * 0.3);

    await supabase.from("affiliate_commissions").insert({
      affiliate_user_id: userProfile.referred_by,
      referred_user_id: userId,
      commission_cents: commissionCents,
      status: "pending",
    });

    await supabase.from("transactions").insert({
      user_id: userProfile.referred_by,
      type: "commission",
      amount_cents: commissionCents,
      description: "Comissão 30% de depósito (Stripe)",
      payment_method: "affiliate",
      payment_gateway: "stripe",
      status: "confirmed",
    });

    const { data: affBal } = await supabase
      .from("balances")
      .select("balance_cents, total_deposited_cents")
      .eq("user_id", userProfile.referred_by)
      .single();

    if (affBal) {
      await supabase.from("balances").update({
        balance_cents: affBal.balance_cents + commissionCents,
        total_deposited_cents: affBal.total_deposited_cents + commissionCents,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userProfile.referred_by);
    }
  }

  // Atualizar lead_captures
  await supabase.from("lead_captures").update({
    has_paid: true,
    total_paid_cents: bal.total_deposited_cents + amountCents,
    last_login_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ── WEBHOOK ──
    if (action === "webhook") {
      if (!STRIPE_WEBHOOK_SECRET) {
        return new Response("Webhook secret não configurado", { status: 500 });
      }

      const stripe = getStripe();
      const signature = req.headers.get("stripe-signature");
      if (!signature) return new Response("Assinatura ausente", { status: 400 });

      const body = await req.text();
      let event: Stripe.Event;

      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.error("Webhook error:", err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, amountCents, credits, packageId } = session.metadata || {};

        if (userId && amountCents) {
          const amount = parseInt(amountCents);
          const creditAmount = parseInt(credits || amountCents);

          // Verificar se já foi processado
          const { data: existingTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("external_id", session.id)
            .maybeSingle();

          if (!existingTx) {
            await creditUserBalance(
              supabase,
              userId,
              amount,
              creditAmount,
              session.id,
              `Depósito Stripe${packageId ? ` (Pacote: ${packageId})` : " (Direto)"}`
            );
          }
        }
      }

      if (event.type === "payment_intent.payment_failed") {
        const intent = event.data.object as Stripe.PaymentIntent;
        await supabase
          .from("transactions")
          .update({ status: "failed" })
          .eq("external_id", intent.id);
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTH CHECK ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const stripe = getStripe();

    // ── CREATE CHECKOUT ──
    if (action === "create-checkout") {
      let body: any = {};
      try { body = await req.json(); } catch (_) {}

      const { price_id, package_id, amount_cents, credits } = body;

      if (!amount_cents || amount_cents < 100) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo: R$ 1,00" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar ou criar Stripe Customer
      let stripeCustomerId: string | undefined;
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      if ((profile as any)?.stripe_customer_id) {
        stripeCustomerId = (profile as any).stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { supabase_uid: user.id },
        });
        stripeCustomerId = customer.id;
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: stripeCustomerId } as any)
          .eq("id", user.id);
      }

      const origin = req.headers.get("origin") || "https://kcwxjmnwdupcqtofejqj.supabase.co";

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          price_id
            ? { price: price_id, quantity: 1 }
            : {
                price_data: {
                  currency: "brl",
                  product_data: {
                    name: `Saldo IAProgramador`,
                    description: `R$ ${(amount_cents / 100).toFixed(2)} em saldo para uso na IA`
                  },
                  unit_amount: amount_cents,
                },
                quantity: 1,
              },
        ],
        mode: "payment",
        success_url: `${origin}/wallet?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/wallet?canceled=true`,
        metadata: {
          userId: user.id,
          packageId: package_id || "",
          amountCents: amount_cents.toString(),
          credits: (credits || amount_cents).toString(),
        },
      });

      // Registrar transação como pending
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount_cents,
        description: `Checkout Stripe - aguardando pagamento`,
        payment_method: "stripe",
        payment_gateway: "stripe",
        external_id: session.id,
        status: "pending",
      });

      return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── VERIFY CHECKOUT SESSION ──
    if (action === "verify-session") {
      let body: any = {};
      try { body = await req.json(); } catch (_) {}
      const { session_id } = body;

      if (!session_id) {
        return new Response(JSON.stringify({ error: "session_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status === "paid") {
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("status")
          .eq("external_id", session_id)
          .maybeSingle();

        if (existingTx && existingTx.status !== "confirmed") {
          const { userId, amountCents, credits, packageId } = session.metadata || {};
          if (userId && amountCents) {
            await creditUserBalance(
              supabase,
              userId,
              parseInt(amountCents),
              parseInt(credits || amountCents),
              session_id,
              `Depósito Stripe${packageId ? ` (Pacote)` : ""}`
            );
          }
        }

        return new Response(JSON.stringify({ paid: true, status: session.payment_status }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ paid: false, status: session.payment_status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("stripe-payment error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
