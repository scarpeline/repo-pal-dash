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
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing Supabase URL or Service Role Key");
  }
  return createClient(url, key);
}

async function asaasFetch(
  baseUrl: string,
  path: string,
  apiKey: string,
  options: RequestInit = {}
) {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        access_token: apiKey,
        ...(options.headers || {}),
      },
    });
    
    const text = await res.text();
    if (!text) return { error: `Resposta vazia da API do Asaas (${res.status})` };
    
    try {
      return JSON.parse(text);
    } catch (e) {
      return { error: `Erro ao processar JSON: ${text.slice(0, 100)}` };
    }
  } catch (err) {
    return { error: `Erro de conexão: ${String(err)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    const url = new URL(req.url);
    let action = url.searchParams.get("action");

<<<<<<< HEAD
    let payload: any = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
        if (!action && payload.action) {
          action = payload.action;
        }
      } catch (_) {
        // Body não é JSON ou está vazio
      }
    }
=======
    if (!action && req.method !== "GET" && req.method !== "HEAD") {
      const rawBody = await req.clone().text().catch(() => "");
      if (rawBody) {
        try {
          const body = JSON.parse(rawBody);
          if (typeof body?.action === "string" && body.action) {
            action = body.action;
          }
        } catch {
          // Ignore non-JSON bodies here; specific handlers can parse them later if needed.
        }
      }
    }

    console.log("asaas-payment", { method: req.method, action });
>>>>>>> bb8f967b14a3040be9edb2179ffff30270865a88

    // ── Webhook from Asaas ──
    if (action === "webhook") {
      const event = payload.event;

      if (
        event === "PAYMENT_CONFIRMED" ||
        event === "PAYMENT_RECEIVED"
      ) {
        const payment = payload.payment;
        const externalRef = payment?.externalReference;
        let userId = null;
        let amountCents = 0;
        let creditsToDeliver = 0;
        let packageId = null;

        if (externalRef && externalRef.includes(":")) {
          // Standard dynamic payment flow
          [userId, amountCents] = externalRef.split(":");
          amountCents = parseInt(amountCents);
        } else if (payment.paymentLink) {
          // Static Payment Link flow (user provided kt6lffsnpy43hsrb etc)
          const { data: pkg } = await supabase
            .from("packages")
            .select("id, credits_amount, price_brl")
            .eq("asaas_payment_link_id", payment.paymentLink)
            .single();

          if (pkg) {
            packageId = pkg.id;
            creditsToDeliver = pkg.credits_amount;
            amountCents = pkg.price_brl;

            // Try to find user by Asaas Customer ID or Email
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .or(`asaas_customer_id.eq.${payment.customer},email.eq.${payment.email}`)
              .maybeSingle();
            
            userId = profile?.id;
          }
        }

        if (userId && amountCents > 0) {
          const { data: bal } = await supabase
            .from("balances")
            .select("balance_cents, total_deposited_cents")
            .eq("user_id", userId)
            .single();

          if (bal) {
            // Credits can be the amount paid (if generic) or specific from package
            const finalCredits = creditsToDeliver > 0 ? creditsToDeliver : amountCents;
            
            await supabase
              .from("balances")
              .update({
                balance_cents: bal.balance_cents + finalCredits,
                total_deposited_cents:
                  bal.total_deposited_cents + amountCents,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);

            // Update or Insert transaction
            const { data: existingTx } = await supabase
              .from("transactions")
              .select("id")
              .eq("external_id", payment.id)
              .maybeSingle();

            if (existingTx) {
              await supabase
                .from("transactions")
                .update({ status: "confirmed" })
                .eq("id", existingTx.id);
            } else {
              await supabase.from("transactions").insert({
                user_id: userId,
                type: "deposit",
                amount_cents: amountCents,
                description: `Depósito via Link Asaas${packageId ? ' (Pacote)' : ''}`,
                payment_method: "link_asaas",
                payment_gateway: "asaas",
                external_id: payment.id,
                status: "confirmed",
              });
            }

            // Affiliate commission 30%
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
                description: "Comissão 30% de depósito",
                payment_method: "affiliate",
                payment_gateway: "asaas",
                status: "confirmed",
              });

              const { data: affBal } = await supabase
                .from("balances")
                .select("balance_cents, total_deposited_cents")
                .eq("user_id", userProfile.referred_by)
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
                  .eq("user_id", userProfile.referred_by);
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

    // ── Sync/validate packages ──
    if (action === "sync-products") {
      const { data: pkgs, error: pkgErr } = await supabase
        .from("packages")
        .select("*")
        .eq("is_active", true);

      if (pkgErr) throw pkgErr;

      const results = [];
      for (const pkg of pkgs || []) {
        // Asaas doesn't have a products API - packages are managed locally
        // Just validate and mark as synced with a local reference
        if (!pkg.asaas_plan_id) {
          const localRef = `pkg_${pkg.id.slice(0, 8)}`;
          await supabase
            .from("packages")
            .update({ asaas_plan_id: localRef })
            .eq("id", pkg.id);
          results.push({ name: pkg.name, status: "synced", id: localRef });
        } else {
          results.push({ name: pkg.name, status: "exists", id: pkg.asaas_plan_id });
        }
      }

      return new Response(JSON.stringify({ sync_results: results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create PIX payment ──
    if (action === "create-pix") {
      const { amount_cents, customer_name, customer_cpf, customer_email, package_id } = payload;

      // Check if we have a specific package product ID
      let asaasProductId = null;
      if (package_id) {
        const { data: pkg } = await supabase
          .from("packages")
          .select("asaas_plan_id")
          .eq("id", package_id)
          .single();
        asaasProductId = pkg?.asaas_plan_id || null;
      }

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
          cpfCnpj: customer_cpf || "00000000000", // CPF de teste se vazio
          externalReference: user.id,
        }),
      });

      if (customerRes.error) {
        return new Response(JSON.stringify({ error: customerRes.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (customerRes.id) {
        customerId = customerRes.id;
        // Save asaas_customer_id to profile for future webhook matching
        await supabase.from("profiles").update({ asaas_customer_id: customerId } as any).eq("id", user.id);
      } else {
        const findRes = await asaasFetch(
          baseUrl,
          `/customers?externalReference=${user.id}`,
          apiKey
        );
        customerId = findRes.data?.[0]?.id || null;
        if (customerId) {
           await supabase.from("profiles").update({ asaas_customer_id: customerId } as any).eq("id", user.id);
        }
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
      const paymentBody: any = {
        customer: customerId,
        billingType: "PIX",
        value: amountBrl,
        dueDate: new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0],
        description: `CodPilot - Crédito R$ ${amountBrl.toFixed(2)}`,
        externalReference: `${user.id}:${amount_cents}`,
      };

      if (asaasProductId) {
        paymentBody.product = asaasProductId;
      }

      const paymentData = await asaasFetch(baseUrl, "/payments", apiKey, {
        method: "POST",
        body: JSON.stringify(paymentBody),
      });

      if (paymentData.error) {
        return new Response(JSON.stringify({ error: paymentData.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pixData = await asaasFetch(
        baseUrl,
        `/payments/${paymentData.id}/pixQrCode`,
        apiKey
      );

      if (pixData.error) {
        return new Response(JSON.stringify({ error: pixData.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          pix_qr_code: pixData?.encodedImage || null,
          pix_copy_paste: pixData?.payload || null,
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
