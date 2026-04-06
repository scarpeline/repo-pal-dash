import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const stripe = new Stripe(STRIPE_SECRET_KEY || "", { apiVersion: "2023-10-16" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ── WEBHOOK ──
    if (action === "webhook") {
      const signature = req.headers.get("stripe-signature")!;
      const body = await req.text();
      let event;

      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET!);
      } catch (err) {
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { userId, amountCents, credits, packageId } = session.metadata || {};

        if (userId) {
          const amount = parseInt(amountCents);
          const creditAmount = parseInt(credits);

          // Get balance
          const { data: bal } = await supabase.from("balances").select("*").eq("user_id", userId).single();
          if (bal) {
            await supabase.from("balances").update({
              balance_cents: bal.balance_cents + creditAmount,
              total_deposited_cents: bal.total_deposited_cents + amount,
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId);

            await supabase.from("transactions").insert({
              user_id: userId,
              type: "deposit",
              amount_cents: amount,
              description: `Depósito Stripe (Pacote: ${packageId || 'Direto'})`,
              payment_method: "stripe",
              payment_gateway: "stripe",
              external_id: session.id,
              status: "confirmed",
            });
          }
        }
      }
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // ── AUTH CHECK ──
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // ── CREATE CHECKOUT ──
    if (action === "create-checkout") {
      const { price_id, package_id, amount_cents, credits } = await req.json();

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          price_id 
            ? { price: price_id, quantity: 1 } 
            : {
                price_data: {
                  currency: "brl",
                  product_data: { name: `Créditos CodPilot` },
                  unit_amount: amount_cents,
                },
                quantity: 1,
              },
        ],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/wallet?success=true`,
        cancel_url: `${req.headers.get("origin")}/wallet?canceled=true`,
        metadata: {
          userId: user.id,
          packageId: package_id || "",
          amountCents: amount_cents.toString(),
          credits: credits.toString(),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Invalid action", { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
