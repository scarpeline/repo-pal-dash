import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth obrigatória — apenas admin ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: adminRole } = await supabase
    .from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!adminRole) {
    return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
        results.deepseek = { balance: bal !== null ? String(bal) : null, error: null, currency: "USD", low: !isNaN(num) && num < 1 };
      } else {
        results.deepseek = { balance: null, error: `HTTP ${res.status}`, currency: "USD" };
      }
    } catch (e) {
      results.deepseek = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.deepseek = { balance: null, error: "API key não configurada", currency: "USD" };
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
        results.kimi = { balance: bal !== null ? String(bal) : null, error: null, currency: "CNY", low: !isNaN(num) && num < 5 };
      } else {
        results.kimi = { balance: null, error: `HTTP ${res.status}`, currency: "CNY" };
      }
    } catch (e) {
      results.kimi = { balance: null, error: String(e), currency: "CNY" };
    }
  } else {
    results.kimi = { balance: null, error: "API key não configurada", currency: "CNY" };
  }

  // ── Groq — valida key via /models ──
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` },
      });
      results.groq = {
        balance: res.ok ? "Key válida" : null,
        error: res.ok ? null : `HTTP ${res.status}`,
        currency: "USD",
        low: false,
      };
    } catch (e) {
      results.groq = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.groq = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  // ── Gemini — valida key via /models ──
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      results.gemini = {
        balance: res.ok ? "Gratuito" : null,
        error: res.ok ? null : `HTTP ${res.status}`,
        currency: "USD",
        low: false,
      };
    } catch (e) {
      results.gemini = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.gemini = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  // ── Anthropic — valida key via /models ──
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      });
      results.anthropic = {
        balance: res.ok ? "Key válida" : null,
        error: res.ok ? null : `HTTP ${res.status}`,
        currency: "USD",
        low: false,
      };
    } catch (e) {
      results.anthropic = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.anthropic = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  // ── OpenRouter — valida key + saldo real ──
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
          low: !isNaN(num) && num < 0.5,
        };
      } else {
        results.openrouter = { balance: null, error: `HTTP ${res.status}`, currency: "USD" };
      }
    } catch (e) {
      results.openrouter = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.openrouter = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  // ── OpenAI — valida key via /models ──
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openaiKey}` },
      });
      results.openai = {
        balance: res.ok ? "Key válida" : null,
        error: res.ok ? null : `HTTP ${res.status}`,
        currency: "USD",
        low: false,
      };
    } catch (e) {
      results.openai = { balance: null, error: String(e), currency: "USD" };
    }
  } else {
    results.openai = { balance: null, error: "API key não configurada", currency: "USD" };
  }

  return new Response(JSON.stringify({ balances: results, checkedAt: new Date().toISOString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
