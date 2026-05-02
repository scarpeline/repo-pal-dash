import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const authHeader = req.headers.get("Authorization");
  let user: any = null;
  
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser } } = await supabase.auth.getUser(token);
    user = authUser;
  }

  // Se não houver auth, pode ser uma chamada do cron/background (precisa de verificação adicional ou ser trigger manual via dashboard)
  // Para simplificar, permitiremos se vier com service role ou se for admin autenticado
  if (user) {
    const { data: adminRole } = await supabase
      .from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const geminiKey     = Deno.env.get("GEMINI_API_KEY");
  const deepseekKey   = Deno.env.get("DEEPSEEK_API_KEY");
  const kimiKey       = Deno.env.get("KIMI_API_KEY");
  const groqKey       = Deno.env.get("GROQ_API_KEY");
  const anthropicKey  = Deno.env.get("ANTHROPIC_API_KEY");
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const openaiKey     = Deno.env.get("OPENAI_API_KEY");

  type BalanceEntry = { balance: string | null; error: string | null; currency: string; low?: boolean };
  const results: Record<string, BalanceEntry> = {};

  // Get threshold from app_settings
  const { data: thresholdSetting } = await supabase.from("app_settings").select("value").eq("key", "low_balance_alert_threshold").maybeSingle();
  const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 1.0;

  // ── DeepSeek ──
  if (deepseekKey) {
    try {
      const res = await fetch("https://api.deepseek.com/user/balance", {
        headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const bal = data?.balance_infos?.[0]?.total_balance ?? data?.balance ?? null;
        const num = parseFloat(bal);
        results.deepseek = { balance: bal !== null ? String(bal) : null, error: null, currency: "USD", low: !isNaN(num) && num < threshold };
      } else {
        results.deepseek = { balance: null, error: `HTTP ${res.status}`, currency: "USD" };
      }
    } catch (e) {
      results.deepseek = { balance: null, error: String(e), currency: "USD" };
    }
  }

  // ── Kimi (Moonshot) ──
  if (kimiKey) {
    try {
      const res = await fetch("https://api.moonshot.cn/v1/users/me/balance", {
        headers: { Authorization: `Bearer ${kimiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const bal = data?.data?.available_balance ?? data?.balance ?? null;
        const num = parseFloat(bal);
        results.kimi = { balance: bal !== null ? String(bal) : null, error: null, currency: "CNY", low: !isNaN(num) && num < (threshold * 7) };
      } else {
        results.kimi = { balance: null, error: `HTTP ${res.status}`, currency: "CNY" };
      }
    } catch (e) {
      results.kimi = { balance: null, error: String(e), currency: "CNY" };
    }
  }

  // ── OpenRouter ──
  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${openrouterKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const credits = data?.data?.limit_remaining ?? data?.data?.usage ?? null;
        const num = parseFloat(credits);
        results.openrouter = {
          balance: credits !== null ? `$${Number(credits).toFixed(4)}` : "Key válida",
          error: null,
          currency: "USD",
          low: !isNaN(num) && num < threshold,
        };
      } else {
        results.openrouter = { balance: null, error: `HTTP ${res.status}`, currency: "USD" };
      }
    } catch (e) {
      results.openrouter = { balance: null, error: String(e), currency: "USD" };
    }
  }

  // Add validation-only models (keys only)
  const validateKeys = [
    { id: "groq", key: groqKey, url: "https://api.groq.com/openai/v1/models" },
    { id: "gemini", key: geminiKey, url: `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}` },
    { id: "anthropic", key: anthropicKey, url: "https://api.anthropic.com/v1/models", headers: { "x-api-key": anthropicKey || "", "anthropic-version": "2023-06-01" } },
    { id: "openai", key: openaiKey, url: "https://api.openai.com/v1/models" }
  ];

  for (const item of validateKeys) {
    if (item.key) {
      try {
        const headers: any = item.headers || { Authorization: `Bearer ${item.key}` };
        const res = await fetch(item.url, { headers });
        results[item.id] = {
          balance: res.ok ? "Key válida" : null,
          error: res.ok ? null : `HTTP ${res.status}`,
          currency: "USD",
          low: false,
        };
      } catch (e) {
        results[item.id] = { balance: null, error: String(e), currency: "USD" };
      }
    }
  }

  // ── Alerta de saldo baixo ──
  const lowBalances = Object.entries(results).filter(([_, info]) => info.low);
  
  if (lowBalances.length > 0) {
    const { data: adminEmailSetting } = await supabase.from("app_settings").select("value").eq("key", "admin_notification_email").maybeSingle();
    const adminEmail = adminEmailSetting?.value || "iaprogramador.online@gmail.com";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (resendApiKey) {
      const alertList = lowBalances.map(([id, info]) => `<li><strong>${id.toUpperCase()}</strong>: ${info.balance} ${info.currency}</li>`).join("");
      
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Alerta Saldo IA <noreply@iaprogramador.online>",
          to: [adminEmail],
          subject: "⚠️ Alerta de Saldo Baixo - APIs de IA",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2 style="color: #e11d48;">⚠️ Saldo Crítico em APIs</h2>
              <p>Os seguintes provedores estão com saldo abaixo do limite de segurança ($ ${threshold}):</p>
              <ul>${alertList}</ul>
              <p>Por favor, realize a recarga para evitar interrupções no serviço.</p>
              <hr />
              <p style="font-size: 12px; color: #666;">Verificado em: ${new Date().toLocaleString("pt-BR")}</p>
            </div>
          `,
        }),
      });
    }

    // Também enviar notificação interna para todos os admins
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      const adminIds = admins.map(a => a.user_id);
      await fetch(`https://${Deno.env.get("SUPABASE_PROJECT_ID")}.supabase.co/functions/v1/send-notification`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({ 
          user_ids: adminIds, 
          title: "⚠️ Saldo IA Baixo", 
          message: `Os provedores ${lowBalances.map(b => b[0]).join(", ")} estão com saldo crítico.` 
        }),
      });
    }
  }

  return new Response(JSON.stringify({ balances: results, checkedAt: new Date().toISOString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});