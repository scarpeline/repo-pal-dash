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

            // Update lead_captures
            await supabase.from("lead_captures").update({
              has_paid: true,
              total_paid_cents: (bal.total_deposited_cents || 0) + amount,
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId);

            // Affiliate commission 30%
            const { data: profile } = await supabase
              .from("profiles")
              .select("referred_by")
              .eq("id", userId)
              .single();

            if (profile?.referred_by && profile.referred_by !== userId) {
              const commissionCents = Math.floor(amount * 0.3);
              await supabase.from("affiliate_commissions").insert({
                affiliate_user_id: profile.referred_by,
                referred_user_id: userId,
                commission_cents: commissionCents,
                status: "pending",
              });
              await supabase.from("transactions").insert({
                user_id: profile.referred_by,
                type: "commission",
                amount_cents: commissionCents,
                description: "Comissão 30% de depósito Stripe",
                payment_method: "affiliate",
                payment_gateway: "stripe",
                status: "confirmed",
              });
              const { data: affBal } = await supabase
                .from("balances")
                .select("balance_cents, total_deposited_cents")
                .eq("user_id", profile.referred_by)
                .single();
              if (affBal) {
                await supabase.from("balances").update({
                  balance_cents: affBal.balance_cents + commissionCents,
                  total_deposited_cents: affBal.total_deposited_cents + commissionCents,
                  updated_at: new Date().toISOString(),
                }).eq("user_id", profile.referred_by);
              }
            }
          }
        }
      }
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // ── LIST PRICES (internal) ──
    if (action === "list-prices") {
      const products = ["prod_UI9XYl8qmJCYme", "prod_UI9cRFnA9CnbK5", "prod_UI9gnJ8rU9g3De"];
      const all: any[] = [];
      for (const prod of products) {
        const prices = await stripe.prices.list({ product: prod, active: true, limit: 20 });
        for (const p of prices.data) {
          all.push({ id: p.id, product: prod, amount: p.unit_amount, currency: p.currency });
        }
      }
      return new Response(JSON.stringify(all), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTH CHECK ──
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // ── CREATE CHECKOUT ──
    if (action === "create-checkout") {
      const { package_id, amount_cents, credits } = await req.json();

      // Lookup stripe_price_id from packages table
      let stripePriceId: string | null = null;
      let pkgCredits = credits;
      
      if (package_id) {
        const { data: pkg } = await supabase
          .from("packages")
          .select("stripe_price_id, credits_amount, price_brl")
          .eq("id", package_id)
          .single();
        if (pkg?.stripe_price_id) {
          stripePriceId = pkg.stripe_price_id;
          pkgCredits = pkg.credits_amount;
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          stripePriceId
            ? { price: stripePriceId, quantity: 1 }
            : {
                price_data: {
                  currency: "brl",
                  product_data: { name: "Créditos CodPilot" },
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
          credits: pkgCredits.toString(),
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
