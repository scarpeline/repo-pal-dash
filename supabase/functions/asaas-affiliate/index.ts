import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function asaasFetch(baseUrl: string, path: string, apiKey: string, options: RequestInit = {}) {
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
    if (!text) return { error: `Resposta vazia (${res.status})` };
    try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
  } catch (err) {
    return { error: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth obrigatória
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { apiKey, baseUrl } = getAsaasConfig();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Asaas não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ── Criar subconta Asaas para o afiliado ──
    if (action === "create-wallet") {
      const {
        name, email, cpf_cnpj, birth_date,
        mobile_phone, address, address_number,
        province, postal_code, income_value,
        company_type, // "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION" — só PJ
      } = body;

      // Validações básicas
      if (!name || !email || !cpf_cnpj || !mobile_phone || !address || !address_number || !postal_code || !income_value) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: nome, email, CPF/CNPJ, celular, endereço, número, CEP, renda mensal" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cpfClean = cpf_cnpj.replace(/\D/g, "");
      const isPJ = cpfClean.length === 14;

      // Verificar se já tem wallet
      const { data: existingProfile } = await supabase
        .from("profiles").select("asaas_wallet_id").eq("id", user.id).maybeSingle();

      if ((existingProfile as any)?.asaas_wallet_id) {
        return new Response(JSON.stringify({
          ok: true,
          wallet_id: (existingProfile as any).asaas_wallet_id,
          message: "Conta Asaas já cadastrada.",
          already_exists: true,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Criar subconta no Asaas
      const accountPayload: any = {
        name,
        email,
        cpfCnpj: cpfClean,
        mobilePhone: mobile_phone.replace(/\D/g, ""),
        address,
        addressNumber: address_number,
        province: province || "",
        postalCode: postal_code.replace(/\D/g, ""),
        incomeValue: parseFloat(income_value),
      };

      if (!isPJ && birth_date) {
        accountPayload.birthDate = birth_date; // formato YYYY-MM-DD
      }
      if (isPJ && company_type) {
        accountPayload.companyType = company_type;
      }

      const result = await asaasFetch(baseUrl, "/accounts", apiKey, {
        method: "POST",
        body: JSON.stringify(accountPayload),
      });

      if (result.error || result.errors) {
        const errMsg = result.error || result.errors?.[0]?.description || "Erro ao criar conta Asaas";
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // walletId retornado pelo Asaas
      const walletId = result.walletId || result.id;
      if (!walletId) {
        return new Response(JSON.stringify({ error: "Asaas não retornou walletId", raw: result }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Salvar no perfil do afiliado
      await supabase.from("profiles").update({
        asaas_wallet_id: walletId,
        asaas_account_id: result.id,
      } as any).eq("id", user.id);

      return new Response(JSON.stringify({
        ok: true,
        wallet_id: walletId,
        account_id: result.id,
        message: "Conta Asaas criada com sucesso! Você já pode receber split de pagamentos.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Buscar status da conta Asaas do afiliado ──
    if (action === "get-wallet-status") {
      const { data: profile } = await supabase
        .from("profiles").select("asaas_wallet_id, asaas_account_id").eq("id", user.id).maybeSingle();

      const walletId = (profile as any)?.asaas_wallet_id;
      if (!walletId) {
        return new Response(JSON.stringify({ has_wallet: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        has_wallet: true,
        wallet_id: walletId,
        account_id: (profile as any)?.asaas_account_id,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
