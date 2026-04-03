import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getAsaasConfig() {
  const mode = Deno.env.get("ASAAS_MODE") || "sandbox";
  const isSandbox = mode === "sandbox";
  const apiKey = isSandbox
    ? Deno.env.get("ASAAS_SANDBOX_API_KEY")
    : Deno.env.get("ASAAS_API_KEY");
  const baseUrl = isSandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
  return { apiKey, baseUrl, isSandbox };
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function asaasFetch(
  baseUrl: string,
  path: string,
  apiKey: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options.headers || {}),
    },
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { apiKey, baseUrl, isSandbox } = getAsaasConfig();
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: `Asaas ${isSandbox ? "sandbox" : "production"} API key not configured`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = getSupabase();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Webhook from Asaas ──
    if (action === "webhook") {
      const payload = await req.json();
      const event = payload.event;

      if (
        event === "PAYMENT_CONFIRMED" ||
        event === "PAYMENT_RECEIVED"
      ) {
        const externalRef = payload.payment?.externalReference;
        if (externalRef) {
          const [userId, amountStr] = externalRef.split(":");
          const amountCents = parseInt(amountStr);

          if (userId && amountCents > 0) {
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
                  total_deposited_cents:
                    bal.total_deposited_cents + amountCents,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);
            }

            await supabase
              .from("transactions")
              .update({ status: "confirmed" })
              .eq("external_id", payload.payment.id);

            // Affiliate commission 30%
            const { data: profile } = await supabase
              .from("profiles")
              .select("referred_by")
              .eq("id", userId)
              .single();

            if (profile?.referred_by) {
              const commissionCents = Math.floor(amountCents * 0.3);

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
                description: "Comissão 30% de depósito PIX",
                payment_method: "pix_asaas",
                payment_gateway: "asaas",
                status: "confirmed",
              });

              const { data: affBal } = await supabase
                .from("balances")
                .select("balance_cents, total_deposited_cents")
                .eq("user_id", profile.referred_by)
                .single();

              if (affBal) {
                await supabase
                  .from("balances")
                  .update({
                    balance_cents: affBal.balance_cents + commissionCents,
                    total_deposited_cents:
                      affBal.total_deposited_cents + commissionCents,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("user_id", profile.referred_by);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Auth required for remaining actions ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get wallet balance ──
    if (action === "balance") {
      const { data: bal } = await supabase
        .from("balances")
        .select("*")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({ balance: bal }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Transaction history ──
    if (action === "transactions") {
      const { data: txns } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ transactions: txns }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get Asaas tokenization config ──
    if (action === "tokenize-config") {
      return new Response(
        JSON.stringify({
          sandbox: isSandbox,
          asaas_js_url: isSandbox
            ? "https://sandbox.asaas.com/checkout/asaas.js"
            : "https://www.asaas.com/checkout/asaas.js",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Create PIX payment ──
    if (action === "create-pix") {
      const { amount_cents, customer_name, customer_cpf, customer_email } =
        await req.json();

      if (!amount_cents || amount_cents < 500) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo: R$ 5,00" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find or create Asaas customer
      let customerId: string | null = null;

      const customerRes = await asaasFetch(baseUrl, "/customers", apiKey, {
        method: "POST",
        body: JSON.stringify({
          name: customer_name || user.email,
          email: customer_email || user.email,
          cpfCnpj: customer_cpf,
          externalReference: user.id,
        }),
      });

      if (customerRes.id) {
        customerId = customerRes.id;
      } else {
        const findRes = await asaasFetch(
          baseUrl,
          `/customers?externalReference=${user.id}`,
          apiKey
        );
        customerId = findRes.data?.[0]?.id || null;
      }

      if (!customerId) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar cliente Asaas" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const amountBrl = amount_cents / 100;
      const paymentData = await asaasFetch(baseUrl, "/payments", apiKey, {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: amountBrl,
          dueDate: new Date(Date.now() + 86400000)
            .toISOString()
            .split("T")[0],
          description: `CodPilot - Crédito R$ ${amountBrl.toFixed(2)}`,
          externalReference: `${user.id}:${amount_cents}`,
        }),
      });

      const pixData = await asaasFetch(
        baseUrl,
        `/payments/${paymentData.id}/pixQrCode`,
        apiKey
      );

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount_cents,
        description: `Depósito PIX R$ ${amountBrl.toFixed(2)}`,
        payment_method: "pix_asaas",
        payment_gateway: "asaas",
        external_id: paymentData.id,
        status: "pending",
      });

      return new Response(
        JSON.stringify({
          payment_id: paymentData.id,
          pix_qr_code: pixData.encodedImage,
          pix_copy_paste: pixData.payload,
          invoice_url: paymentData.invoiceUrl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Create credit card payment via Asaas token ──
    if (action === "create-card") {
      const { amount_cents, customer_cpf, customer_name, card_token } =
        await req.json();

      if (!amount_cents || amount_cents < 500) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo: R$ 5,00" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let customerId: string | null = null;
      const customerRes = await asaasFetch(baseUrl, "/customers", apiKey, {
        method: "POST",
        body: JSON.stringify({
          name: customer_name || user.email,
          email: user.email,
          cpfCnpj: customer_cpf,
          externalReference: user.id,
        }),
      });
      customerId = customerRes.id;
      if (!customerId) {
        const findRes = await asaasFetch(
          baseUrl,
          `/customers?externalReference=${user.id}`,
          apiKey
        );
        customerId = findRes.data?.[0]?.id || null;
      }

      if (!customerId) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar cliente" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const amountBrl = amount_cents / 100;
      const paymentData = await asaasFetch(baseUrl, "/payments", apiKey, {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: amountBrl,
          dueDate: new Date().toISOString().split("T")[0],
          description: `CodPilot - Crédito R$ ${amountBrl.toFixed(2)}`,
          externalReference: `${user.id}:${amount_cents}`,
          creditCardToken: card_token,
        }),
      });

      if (paymentData.errors) {
        return new Response(
          JSON.stringify({
            error:
              paymentData.errors[0]?.description || "Erro no pagamento",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount_cents,
        description: `Depósito Cartão R$ ${amountBrl.toFixed(2)}`,
        payment_method: "credit_card",
        payment_gateway: "asaas",
        external_id: paymentData.id,
        status: paymentData.status === "CONFIRMED" ? "confirmed" : "pending",
      });

      if (paymentData.status === "CONFIRMED") {
        const { data: bal } = await supabase
          .from("balances")
          .select("balance_cents, total_deposited_cents")
          .eq("user_id", user.id)
          .single();
        if (bal) {
          await supabase
            .from("balances")
            .update({
              balance_cents: bal.balance_cents + amount_cents,
              total_deposited_cents:
                bal.total_deposited_cents + amount_cents,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);
        }
      }

      return new Response(
        JSON.stringify({
          payment_id: paymentData.id,
          status: paymentData.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
