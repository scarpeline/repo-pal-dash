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

async function creditUserBalance(
  supabase: any,
  userId: string,
  amountCents: number,
  creditsToDeliver: number,
  externalId: string,
  description: string,
  paymentMethod: string
) {
  const { data: bal } = await supabase
    .from("balances")
    .select("balance_cents, total_deposited_cents")
    .eq("user_id", userId)
    .single();

  if (!bal) return false;
  const b = bal as any;

  const finalCredits = creditsToDeliver > 0 ? creditsToDeliver : amountCents;

  await supabase
    .from("balances")
    .update({
      balance_cents: b.balance_cents + finalCredits,
      total_deposited_cents: b.total_deposited_cents + amountCents,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Upsert transaction
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("external_id", externalId)
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
      description,
      payment_method: paymentMethod,
      payment_gateway: "asaas",
      external_id: externalId,
      status: "confirmed",
    });
  }

  // Comissão de afiliado 30%
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
          total_deposited_cents: affBal.total_deposited_cents + commissionCents,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userProfile.referred_by);
    }
  }

  // Atualizar lead_captures
  await supabase
    .from("lead_captures")
    .update({
      has_paid: true,
      total_paid_cents: bal.total_deposited_cents + amountCents,
      last_login_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return true;
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

    console.log("asaas-payment", { method: req.method, action });

    // ── Webhook from Asaas ──
    if (action === "webhook") {
      const event = payload.event;

      if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
        const payment = payload.payment;
        const externalRef = payment?.externalReference;
        let userId: string | null = null;
        let amountCents = 0;
        let creditsToDeliver = 0;
        let packageId: string | null = null;

        if (externalRef && externalRef.includes(":")) {
          // Fluxo dinâmico padrão: userId:amountCents
          const parts = externalRef.split(":");
          userId = parts[0];
          amountCents = parseInt(parts[1]);
        } else if (payment.paymentLink) {
          // Fluxo de Link de Pagamento Estático
          const { data: pkg } = await supabase
            .from("packages")
            .select("id, credits_amount, price_brl")
            .eq("asaas_payment_link_id", payment.paymentLink)
            .single();

          if (pkg) {
            packageId = pkg.id;
            creditsToDeliver = pkg.credits_amount;
            amountCents = pkg.price_brl;

            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .or(
                `asaas_customer_id.eq.${payment.customer},email.eq.${payment.email}`
              )
              .maybeSingle();

            userId = profile?.id || null;
          }
        }

        if (userId && amountCents > 0) {
          await creditUserBalance(
            supabase,
            userId,
            amountCents,
            creditsToDeliver,
            payment.id,
            `Depósito via ${packageId ? "Pacote Asaas" : "Link Asaas"}`,
            "link_asaas"
          );
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

      if (!amount_cents || amount_cents < 500) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo: R$ 5,00" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Busca o pacote se informado para obter créditos corretos
      let packageCredits = 0;
      if (package_id) {
        const { data: pkg } = await supabase
          .from("packages")
          .select("credits_amount")
          .eq("id", package_id)
          .single();
        packageCredits = pkg?.credits_amount || 0;
      }

      // Buscar ou criar cliente Asaas
      let customerId: string | null = null;

      // Verificar se já temos o customer_id salvo
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("asaas_customer_id")
        .eq("id", user.id)
        .single();

      if ((existingProfile as any)?.asaas_customer_id) {
        customerId = (existingProfile as any).asaas_customer_id;
      } else {
        const customerRes = await asaasFetch(baseUrl, "/customers", apiKey, {
          method: "POST",
          body: JSON.stringify({
            name: customer_name || user.email,
            email: customer_email || user.email,
            cpfCnpj: customer_cpf || "00000000000",
            externalReference: user.id,
          }),
        });

        if (customerRes.id) {
          customerId = customerRes.id;
          await supabase
            .from("profiles")
            .update({ asaas_customer_id: customerId } as any)
            .eq("id", user.id);
        } else {
          const findRes = await asaasFetch(
            baseUrl,
            `/customers?externalReference=${user.id}`,
            apiKey
          );
          customerId = findRes.data?.[0]?.id || null;
          if (customerId) {
            await supabase
              .from("profiles")
              .update({ asaas_customer_id: customerId } as any)
              .eq("id", user.id);
          }
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
        description: `IAProgramador - Crédito R$ ${amountBrl.toFixed(2)}`,
        externalReference: `${user.id}:${amount_cents}${package_id ? `:${package_id}` : ""}`,
      };

      const paymentData = await asaasFetch(baseUrl, "/payments", apiKey, {
        method: "POST",
        body: JSON.stringify(paymentBody),
      });

      if (paymentData.error || paymentData.errors) {
        const errMsg = paymentData.error || paymentData.errors?.[0]?.description || "Erro ao criar cobrança";
        return new Response(JSON.stringify({ error: errMsg }), {
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
          package_credits: packageCredits,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Verificar status de um pagamento PIX ──
    if (action === "check-payment") {
      const { payment_id } = payload;
      if (!payment_id) {
        return new Response(JSON.stringify({ error: "payment_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentData = await asaasFetch(baseUrl, `/payments/${payment_id}`, apiKey);

      if (paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED") {
        // Verificar se já foi creditado
        const { data: tx } = await supabase
          .from("transactions")
          .select("status")
          .eq("external_id", payment_id)
          .maybeSingle();

        if (tx && tx.status !== "confirmed") {
          const externalRef = paymentData.externalReference || "";
          let amountCents = 0;
          let packageCredits = 0;

          if (externalRef.includes(":")) {
            const parts = externalRef.split(":");
            amountCents = parseInt(parts[1]);
            const packageId = parts[2] || null;

            if (packageId) {
              const { data: pkg } = await supabase
                .from("packages")
                .select("credits_amount")
                .eq("id", packageId)
                .single();
              packageCredits = pkg?.credits_amount || 0;
            }
          }

          if (amountCents > 0) {
            await creditUserBalance(
              supabase,
              user.id,
              amountCents,
              packageCredits,
              payment_id,
              `Depósito PIX confirmado`,
              "pix_asaas"
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ status: paymentData.status }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Create credit card payment via Asaas token ──
    if (action === "create-card") {
      const { amount_cents, customer_cpf, customer_name, card_token, package_id } = payload;

      if (!amount_cents || amount_cents < 500) {
        return new Response(
          JSON.stringify({ error: "Valor mínimo: R$ 5,00" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let packageCredits = 0;
      if (package_id) {
        const { data: pkg } = await supabase
          .from("packages")
          .select("credits_amount")
          .eq("id", package_id)
          .single();
        packageCredits = pkg?.credits_amount || 0;
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
          description: `IAProgramador - Crédito R$ ${amountBrl.toFixed(2)}`,
          externalReference: `${user.id}:${amount_cents}${package_id ? `:${package_id}` : ""}`,
          creditCardToken: card_token,
        }),
      });

      if (paymentData.errors) {
        return new Response(
          JSON.stringify({
            error: paymentData.errors[0]?.description || "Erro no pagamento",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const isConfirmed = paymentData.status === "CONFIRMED";

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount_cents,
        description: `Depósito Cartão R$ ${amountBrl.toFixed(2)}`,
        payment_method: "credit_card",
        payment_gateway: "asaas",
        external_id: paymentData.id,
        status: isConfirmed ? "confirmed" : "pending",
      });

      if (isConfirmed) {
        await creditUserBalance(
          supabase,
          user.id,
          amount_cents,
          packageCredits,
          paymentData.id,
          `Cartão confirmado R$ ${amountBrl.toFixed(2)}`,
          "credit_card"
        );
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
