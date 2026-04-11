import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is blocked
    const { data: rolesData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "blocked");
    
    if (rolesData && rolesData.length > 0) {
      return new Response(JSON.stringify({ error: "Sua conta foi bloqueada. Acesso à IA restrito." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: 30 req/min
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from("token_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);

    if ((recentCount ?? 0) >= 30) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { messages, fileContent, fileName, repoName, branch } = body;

    // ── Check AI Balances (Super Admin action) ──
    if (body.action === "check-ai-balances") {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
      const kimiKey = Deno.env.get("KIMI_API_KEY");
      const groqKey = Deno.env.get("GROQ_API_KEY");

      const results: Record<string, { balance: string | null; error: string | null; currency: string }> = {};

      if (deepseekKey) {
        try {
          const res = await fetch("https://api.deepseek.com/user/balance", { headers: { Authorization: `Bearer ${deepseekKey}` } });
          if (res.ok) {
            const data = await res.json();
            const balance = data?.balance_infos?.[0]?.total_balance ?? data?.balance ?? null;
            results.deepseek = { balance: balance !== null ? String(balance) : null, error: null, currency: "USD" };
          } else {
            results.deepseek = { balance: null, error: `HTTP ${res.status}`, currency: "USD" };
          }
        } catch (e) { results.deepseek = { balance: null, error: String(e), currency: "USD" }; }
      } else {
        results.deepseek = { balance: null, error: "API key não configurada", currency: "USD" };
      }

      if (kimiKey) {
        try {
          const res = await fetch("https://api.moonshot.cn/v1/users/me/balance", { headers: { Authorization: `Bearer ${kimiKey}` } });
          if (res.ok) {
            const data = await res.json();
            const balance = data?.data?.available_balance ?? data?.balance ?? null;
            results.kimi = { balance: balance !== null ? String(balance) : null, error: null, currency: "CNY" };
          } else {
            results.kimi = { balance: null, error: `HTTP ${res.status}`, currency: "CNY" };
          }
        } catch (e) { results.kimi = { balance: null, error: String(e), currency: "CNY" }; }
      } else {
        results.kimi = { balance: null, error: "API key não configurada", currency: "CNY" };
      }

      if (groqKey) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${groqKey}` } });
          results.groq = { balance: res.ok ? "Key válida" : null, error: res.ok ? null : `HTTP ${res.status}`, currency: "USD" };
        } catch (e) { results.groq = { balance: null, error: String(e), currency: "USD" }; }
      } else {
        results.groq = { balance: null, error: "API key não configurada", currency: "USD" };
      }

      if (geminiKey) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
          results.gemini = { balance: res.ok ? "Gratuito" : null, error: res.ok ? null : `HTTP ${res.status}`, currency: "USD" };
        } catch (e) { results.gemini = { balance: null, error: String(e), currency: "USD" }; }
      } else {
        results.gemini = { balance: null, error: "API key não configurada", currency: "USD" };
      }

      return new Response(JSON.stringify({ balances: results, checkedAt: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Normalize model ID ──
    // The frontend sends short IDs like "gemini", "deepseek", "groq", "auto", etc.
    // We normalize to a canonical short ID for routing.
    const rawModel = body.model || "gemini";
    
    // Map any full model path back to short ID
    const fullPathToShortId: Record<string, string> = {
      "google/gemini-2.5-flash": "gemini",
      "google/gemini-3-flash-preview": "gemini",
      "google/gemini-2.5-pro": "gemini",
      "deepseek/deepseek-coder": "deepseek",
      "groq/llama-4-scout": "groq",
      "groq/llama-3.1-8b": "groq-8b",
      "groq/gpt-oss": "gpt-oss",
      "moonshot/moonshot-v1-32k": "kimi",
      "openrouter/deepseek-free": "openrouter",
      "anthropic/claude-haiku-4-5": "claude-haiku",
      "anthropic/claude-sonnet-4-5": "claude-sonnet",
      "anthropic/claude-opus-4-6": "claude-opus",
      "openai/gpt-4o-mini": "openai",
    };

    const selectedModel = fullPathToShortId[rawModel] || rawModel;
    console.log("ai-chat request:", { userId: user.id, rawModel, selectedModel, messageCount: messages?.length });

    // ── Map short ID to pricing model_id ──
    const modelIdMap: Record<string, string> = {
      "auto":           "google/gemini-2.5-flash",
      "gemini":         "google/gemini-2.5-flash",
      "deepseek":       "deepseek/deepseek-coder",
      "groq":           "groq/llama-4-scout",
      "groq-8b":        "groq/llama-3.1-8b",
      "gpt-oss":        "groq/gpt-oss",
      "kimi":           "moonshot/moonshot-v1-32k",
      "openrouter":     "openrouter/deepseek-free",
      "claude-haiku":   "anthropic/claude-haiku-4-5",
      "claude-sonnet":  "anthropic/claude-sonnet-4-5",
      "claude-opus":    "anthropic/claude-opus-4-6",
      "openai":         "openai/gpt-4o-mini",
    };
    const pricingModelId = modelIdMap[selectedModel] || "google/gemini-2.5-flash";

    // Fetch resale pricing
    const { data: pricing } = await supabaseAdmin
      .from("ai_model_pricing")
      .select("resale_price_input_per_million, resale_price_output_per_million, model_label")
      .eq("model_id", pricingModelId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: fallbackPricing } = !pricing ? await supabaseAdmin
      .from("ai_model_pricing")
      .select("resale_price_input_per_million, resale_price_output_per_million")
      .eq("is_active", true)
      .order("resale_price_input_per_million", { ascending: false })
      .limit(1)
      .maybeSingle() : { data: null };

    const activePricing = pricing || fallbackPricing;
    const resaleInput  = activePricing?.resale_price_input_per_million  ?? 500;
    const resaleOutput = activePricing?.resale_price_output_per_million ?? 2000;

    const totalInputChars = messages.reduce((acc: number, m: any) => acc + (m.content?.length || 0), 0);
    const estimatedInputTokens  = Math.max(Math.ceil(totalInputChars / 4), 200);
    const estimatedOutputTokens = 1000;

    const estimatedCostCents = Math.ceil(
      (estimatedInputTokens  / 1_000_000) * resaleInput +
      (estimatedOutputTokens / 1_000_000) * resaleOutput
    );
    const minCharge = Math.max(estimatedCostCents, 20);

    const { data: balance } = await supabaseAdmin
      .from("balances")
      .select("balance_cents, total_spent_cents")
      .eq("user_id", user.id)
      .single();

    const currentBalance = balance?.balance_cents || 0;
    
    if (currentBalance < minCharge) {
      return new Response(
        JSON.stringify({
          error: `Saldo insuficiente. Seu saldo: R$ ${(currentBalance / 100).toFixed(2)}. Custo estimado: R$ ${(minCharge / 100).toFixed(2)}. Recarregue na Carteira.`,
          code: "INSUFFICIENT_BALANCE",
          currentBalance,
          requiredAmount: minCharge
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    const kimiApiKey = Deno.env.get("KIMI_API_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs = 30_000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
    };

    const systemPrompt = `Você é o IAProgramador AI, um assistente de programação integrado a um editor de código online.
Você ajuda a analisar, editar e melhorar código. Responda sempre em português brasileiro.
Quando sugerir alterações de código, use blocos de código com a linguagem apropriada.
Seja conciso e direto.

Se o usuário pedir para modificar/editar arquivos do repositório e você receber o conteúdo dos arquivos,
retorne APENAS um JSON válido (sem markdown) no formato:
{
  "modifications": [
    { "path": "caminho/arquivo", "content": "conteúdo completo", "operation": "update", "message": "descrição" }
  ],
  "summary": "resumo das alterações"
}

Se for uma pergunta normal (não pedido de edição), responda normalmente em texto.${
      repoName ? `\n\nRepositório: ${repoName} (branch: ${branch || "main"})` : ""
    }${
      fileName && fileContent
        ? `\n\nArquivo aberto: ${fileName}\n\`\`\`\n${fileContent.substring(0, 8000)}\n\`\`\``
        : ""
    }`;

    // ── ROUTING: use short IDs exclusively ──
    let content = "";
    let providerName = "Gemini";
    let usedFallback = false;

    const tryGeminiFallback = async (motivo: string): Promise<string> => {
      if (!geminiApiKey) throw new Error("Nenhuma IA disponível. Configure GEMINI_API_KEY.");
      usedFallback = true;
      providerName = "Gemini (fallback)";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const geminiContents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      geminiContents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
      const response = await fetchWithTimeout(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: geminiContents, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }),
      });
      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) throw new Error("Rate limit excedido no Gemini. Aguarde alguns segundos.");
        throw new Error(`Gemini error ${response.status}: ${errText.substring(0, 200)}`);
      }
      const aiResult = await response.json();
      const text = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return `⚠️ _${motivo} — usando Gemini automaticamente._\n\n${text}`;
    };

    // Helper for OpenAI-compatible APIs
    const callOpenAICompatible = async (
      url: string,
      apiKey: string,
      modelName: string,
      extraHeaders: Record<string, string> = {}
    ): Promise<string> => {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, ...extraHeaders },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    };

    // ── Route by short ID ──
    switch (selectedModel) {
      case "claude-haiku":
      case "claude-sonnet":
      case "claude-opus": {
        if (!anthropicApiKey) {
          content = await tryGeminiFallback("Claude não configurado (ANTHROPIC_API_KEY ausente)");
          break;
        }
        const claudeModelMap: Record<string, string> = {
          "claude-haiku": "claude-haiku-4-5",
          "claude-sonnet": "claude-sonnet-4-5",
          "claude-opus": "claude-opus-4-5",
        };
        const claudeNameMap: Record<string, string> = {
          "claude-haiku": "Claude Haiku 4.5",
          "claude-sonnet": "Claude Sonnet 4.5",
          "claude-opus": "Claude Opus 4.5",
        };
        providerName = claudeNameMap[selectedModel] || "Claude";
        try {
          const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: claudeModelMap[selectedModel],
              max_tokens: 4096,
              system: systemPrompt,
              messages: messages.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
            }),
          });
          if (!res.ok) {
            content = await tryGeminiFallback(`Claude retornou erro ${res.status}`);
          } else {
            const data = await res.json();
            content = data.content?.[0]?.text || "";
          }
        } catch (e) {
          content = await tryGeminiFallback(`Claude erro: ${e}`);
        }
        break;
      }

      case "deepseek": {
        if (!deepseekApiKey) {
          content = await tryGeminiFallback("DeepSeek não configurado (DEEPSEEK_API_KEY ausente)");
          break;
        }
        providerName = "DeepSeek";
        try {
          content = await callOpenAICompatible(
            "https://api.deepseek.com/v1/chat/completions",
            deepseekApiKey,
            "deepseek-coder"
          );
        } catch (e) {
          content = await tryGeminiFallback(`DeepSeek erro: ${e}`);
        }
        break;
      }

      case "kimi": {
        if (!kimiApiKey) {
          content = await tryGeminiFallback("Kimi não configurado (KIMI_API_KEY ausente)");
          break;
        }
        providerName = "Kimi";
        try {
          content = await callOpenAICompatible(
            "https://api.moonshot.cn/v1/chat/completions",
            kimiApiKey,
            "moonshot-v1-32k"
          );
        } catch (e) {
          content = await tryGeminiFallback(`Kimi erro: ${e}`);
        }
        break;
      }

      case "groq":
      case "groq-8b":
      case "gpt-oss": {
        if (!groqApiKey) {
          content = await tryGeminiFallback("Groq não configurado (GROQ_API_KEY ausente)");
          break;
        }
        const groqModelMap: Record<string, string> = {
          "groq": "meta-llama/llama-4-scout-17b-16e-instruct",
          "groq-8b": "llama-3.1-8b-instant",
          "gpt-oss": "meta-llama/llama-4-scout-17b-16e-instruct", // fallback, gpt-oss not on Groq
        };
        const groqNameMap: Record<string, string> = {
          "groq": "Llama 4 Scout (Groq)",
          "groq-8b": "Llama 3.1 8B (Groq)",
          "gpt-oss": "Llama 4 Scout (Groq)",
        };
        providerName = groqNameMap[selectedModel] || "Groq";
        try {
          content = await callOpenAICompatible(
            "https://api.groq.com/openai/v1/chat/completions",
            groqApiKey,
            groqModelMap[selectedModel]
          );
        } catch (e) {
          content = await tryGeminiFallback(`Groq erro: ${e}`);
        }
        break;
      }

      case "openrouter": {
        if (!openrouterApiKey) {
          content = await tryGeminiFallback("OpenRouter não configurado (OPENROUTER_API_KEY ausente)");
          break;
        }
        providerName = "OpenRouter";
        try {
          content = await callOpenAICompatible(
            "https://openrouter.ai/api/v1/chat/completions",
            openrouterApiKey,
            "deepseek/deepseek-chat:free",
            { "HTTP-Referer": "https://iaprogramador.online", "X-Title": "IAProgramador" }
          );
        } catch (e) {
          content = await tryGeminiFallback(`OpenRouter erro: ${e}`);
        }
        break;
      }

      case "openai": {
        // Use Lovable AI Gateway for OpenAI models
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        if (!lovableKey) {
          content = await tryGeminiFallback("OpenAI não configurado");
          break;
        }
        providerName = "GPT-4o mini";
        try {
          content = await callOpenAICompatible(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            lovableKey,
            "openai/gpt-5-nano"
          );
        } catch (e) {
          content = await tryGeminiFallback(`OpenAI erro: ${e}`);
        }
        break;
      }

      // Default: Gemini (handles "auto", "gemini", and any unknown model)
      default: {
        if (!geminiApiKey) {
          return new Response(JSON.stringify({ error: "Nenhuma IA configurada. Configure GEMINI_API_KEY." }), {
            status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        providerName = "Gemini";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
        const geminiContents = messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        geminiContents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
        const response = await fetchWithTimeout(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: geminiContents, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }),
        });
        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit excedido no Gemini. Aguarde." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error(`Gemini error ${response.status}: ${errText.substring(0, 300)}`);
        }
        const aiResult = await response.json();
        content = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
        break;
      }
    }

    // ── Calculate cost and debit ──
    const inputTokens  = estimatedInputTokens;
    const outputTokens = Math.max(Math.ceil(content.length / 4), 100);

    const actualCostCents = Math.max(
      Math.ceil(
        (inputTokens  / 1_000_000) * resaleInput +
        (outputTokens / 1_000_000) * resaleOutput
      ),
      20
    );

    const { data: apiPricing } = await supabaseAdmin
      .from("ai_model_pricing")
      .select("api_cost_input_per_million, api_cost_output_per_million")
      .eq("model_id", pricingModelId)
      .eq("is_active", true)
      .maybeSingle();

    const apiCostInput  = apiPricing?.api_cost_input_per_million  ?? 0;
    const apiCostOutput = apiPricing?.api_cost_output_per_million ?? 0;
    const apiCostCents  = Math.ceil(
      (inputTokens  / 1_000_000) * apiCostInput +
      (outputTokens / 1_000_000) * apiCostOutput
    );

    const platformProfitCents = Math.max(actualCostCents - apiCostCents, 0);
    const affiliateCommissionCents = Math.floor(platformProfitCents * 0.30);

    console.log(`Cobrança: ${inputTokens}+${outputTokens} tokens | modelo: ${selectedModel} (${providerName}) | revenda: R$${(actualCostCents/100).toFixed(4)} | custo: R$${(apiCostCents/100).toFixed(4)}`);

    // Debit user
    try {
      await Promise.all([
        supabaseAdmin.from("balances").update({
          balance_cents: currentBalance - actualCostCents,
          total_spent_cents: ((balance as any).total_spent_cents || 0) + actualCostCents,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id),
        supabaseAdmin.from("token_usage").insert({
          user_id: user.id,
          model: selectedModel,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_cents: actualCostCents,
        }),
      ]);

      // Affiliate commission
      if (affiliateCommissionCents > 0) {
        const { data: userProfile } = await supabaseAdmin
          .from("profiles")
          .select("referred_by")
          .eq("id", user.id)
          .maybeSingle();

        if (userProfile?.referred_by && userProfile.referred_by !== user.id) {
          const affiliateId = userProfile.referred_by;
          const { data: affBal } = await supabaseAdmin
            .from("balances")
            .select("balance_cents, total_deposited_cents")
            .eq("user_id", affiliateId)
            .maybeSingle();

          if (affBal) {
            await Promise.all([
              supabaseAdmin.from("balances").update({
                balance_cents: (affBal as any).balance_cents + affiliateCommissionCents,
                total_deposited_cents: (affBal as any).total_deposited_cents + affiliateCommissionCents,
                updated_at: new Date().toISOString(),
              }).eq("user_id", affiliateId),
              supabaseAdmin.from("transactions").insert({
                user_id: affiliateId,
                type: "commission",
                amount_cents: affiliateCommissionCents,
                description: `Comissão 30% — uso de IA (${providerName})`,
                payment_method: "affiliate",
                payment_gateway: "platform",
                status: "confirmed",
              }),
              supabaseAdmin.from("affiliate_commissions").insert({
                affiliate_user_id: affiliateId,
                referred_user_id: user.id,
                commission_cents: affiliateCommissionCents,
                status: "confirmed",
              }),
            ]);
          }
        }
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
    }

    return new Response(JSON.stringify({
      content,
      provider: providerName,
      model: selectedModel,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_cents: actualCostCents },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
