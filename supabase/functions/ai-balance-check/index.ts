const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
  const kimiKey = Deno.env.get("KIMI_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");

  const results: Record<string, { balance: string | null; error: string | null; currency: string }> = {};

  // DeepSeek balance
  if (deepseekKey) {
    try {
      const res = await fetch("https://api.deepseek.com/user/balance", {
        headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const balance = data?.balance_infos?.[0]?.total_balance ?? data?.balance ?? null;
        results.deepseek = { balance: balance !== null ? String(balance) : null, error: null, currency: "USD" };
      } else {
        results.deepseek = { balance: null, error: `HTTP ${res.status}`, currency: "USD" };
      }
    } catch (e) {
      results.deepseek = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.deepseek = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  // Kimi (Moonshot) balance
  if (kimiKey) {
    try {
      const res = await fetch("https://api.moonshot.cn/v1/users/me/balance", {
        headers: { Authorization: `Bearer ${kimiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const balance = data?.data?.available_balance ?? data?.balance ?? null;
        results.kimi = { balance: balance !== null ? String(balance) : null, error: null, currency: "CNY" };
      } else {
        results.kimi = { balance: null, error: `HTTP ${res.status}`, currency: "CNY" };
      }
    } catch (e) {
      results.kimi = { balance: null, error: String(e), currency: "CNY" };
    }
  } else {
    results.kimi = { balance: null, error: "API key não configurada", currency: "CNY" };
  }

  // Groq — não tem endpoint de saldo público, retorna status da key
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` },
      });
      results.groq = {
        balance: res.ok ? "Key válida (sem endpoint de saldo)" : null,
        error: res.ok ? null : `HTTP ${res.status}`,
        currency: "USD",
      };
    } catch (e) {
      results.groq = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.groq = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  // Gemini — não tem endpoint de saldo, verifica se key é válida
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
      );
      results.gemini = {
        balance: res.ok ? "Gratuito (sem limite de saldo)" : null,
        error: res.ok ? null : `HTTP ${res.status}`,
        currency: "USD",
      };
    } catch (e) {
      results.gemini = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.gemini = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  return new Response(JSON.stringify({ balances: results, checkedAt: new Date().toISOString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
