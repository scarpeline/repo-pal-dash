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

    // Extract user from JWT
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
      return new Response(JSON.stringify({ error: "Sua conta foi temporariamente bloqueada por violação das regras. O acesso à Inteligência Artificial está restrito no momento." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages, fileContent, fileName, repoName, branch, model } = body;

    // ── Check AI Balances (Super Admin action) ──
    if (body.action === "check-ai-balances") {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
      const kimiKey = Deno.env.get("KIMI_API_KEY");
      const groqKey = Deno.env.get("GROQ_API_KEY");

      const results: Record<string, { balance: string | null; error: string | null; currency: string }> = {};

      // DeepSeek
      if (deepseekKey) {
        try {
          const res = await fetch("https://api.deepseek.com/user/balance", {
            headers: { Authorization: `Bearer ${deepseekKey}` },
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

      // Kimi
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

      // Groq
      if (groqKey) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${groqKey}` },
          });
          results.groq = { balance: res.ok ? "Key válida" : null, error: res.ok ? null : `HTTP ${res.status}`, currency: "USD" };
        } catch (e) {
          results.groq = { balance: null, error: String(e), currency: "USD" };
        }
      } else {
        results.groq = { balance: null, error: "API key não configurada", currency: "USD" };
      }

      // Gemini
      if (geminiKey) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
          results.gemini = { balance: res.ok ? "Gratuito" : null, error: res.ok ? null : `HTTP ${res.status}`, currency: "USD" };
        } catch (e) {
          results.gemini = { balance: null, error: String(e), currency: "USD" };
        }
      } else {
        results.gemini = { balance: null, error: "API key não configurada", currency: "USD" };
      }

      return new Response(JSON.stringify({ balances: results, checkedAt: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("ai-chat request:", { 
      userId: user.id, 
      messageCount: messages?.length,
      model: model || "default",
      hasFileContent: !!fileContent,
      hasFileName: !!fileName
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedModel = model || "google/gemini-3-flash-preview";
    console.log("Selected model:", selectedModel);

    // Fetch pricing for this model
    const { data: pricing } = await supabaseAdmin
      .from("ai_model_pricing")
      .select("resale_price_input_per_million, resale_price_output_per_million")
      .eq("model_id", selectedModel)
      .eq("is_active", true)
      .single();

    // Estimate cost (estimate ~500 input tokens, ~1000 output tokens for a typical chat)
    const estimatedInputTokens = 500;
    const estimatedOutputTokens = 1000;
    const resaleInput = pricing?.resale_price_input_per_million || 30;
    const resaleOutput = pricing?.resale_price_output_per_million || 120;
    const estimatedCostCents = Math.ceil(
      (estimatedInputTokens / 1_000_000) * resaleInput +
      (estimatedOutputTokens / 1_000_000) * resaleOutput
    );
    // Minimum charge: 20 centavos (0,20 BRL)
    const minCharge = Math.max(estimatedCostCents, 20);

    // Check user balance
    const { data: balance } = await supabaseAdmin
      .from("balances")
      .select("balance_cents")
      .eq("user_id", user.id)
      .single();

    const currentBalance = balance?.balance_cents || 0;
    console.log(`User ${user.id} balance check: R$ ${(currentBalance / 100).toFixed(2)} vs min charge R$ ${(minCharge / 100).toFixed(2)}`);
    
    if (currentBalance < minCharge) {
      return new Response(
        JSON.stringify({
          error: `Saldo insuficiente. Seu saldo: R$ ${(currentBalance / 100).toFixed(2)}. Custo estimado: R$ ${(minCharge / 100).toFixed(2)}. Recarregue na Carteira.`,
          code: "INSUFFICIENT_BALANCE",
          currentBalance,
          requiredAmount: minCharge
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    const kimiApiKey = Deno.env.get("KIMI_API_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

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

    // Determinar qual provider usar baseado no modelo selecionado
    const isDeepSeek = selectedModel.includes("deepseek");
    const isKimi = selectedModel.includes("moonshot") || selectedModel.includes("kimi");
    const isGroq = selectedModel === "groq" || selectedModel === "gpt-oss" ||
                   selectedModel.includes("llama") || selectedModel.includes("mixtral") ||
                   selectedModel.includes("groq");
    const isOpenRouter = selectedModel === "openrouter" || (selectedModel.includes("/") && !selectedModel.includes("llama-4"));
    const isClaude = selectedModel.includes("claude");

    let content = "";
    let providerName = "Gemini";

    // DeepSeek
    if (isDeepSeek && deepseekApiKey) {
      providerName = "DeepSeek";
      const model = selectedModel.includes("reasoner") ? "deepseek-reasoner" : 
                    selectedModel.includes("coder") ? "deepseek-coder" : "deepseek-chat";
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deepseekApiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) throw new Error(`DeepSeek error: ${await res.text()}`);
      const data = await res.json();
      content = data.choices?.[0]?.message?.content || "";
    }
    // Kimi
    else if (isKimi && kimiApiKey) {
      providerName = "Kimi";
      const model = selectedModel.includes("128k") ? "moonshot-v1-128k" :
                    selectedModel.includes("32k") ? "moonshot-v1-32k" : "moonshot-v1-8k";
      const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${kimiApiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) throw new Error(`Kimi error: ${await res.text()}`);
      const data = await res.json();
      content = data.choices?.[0]?.message?.content || "";
    }
    // Groq — Llama 4 Scout, Llama 3.1 8B, GPT OSS
    else if (isGroq && groqApiKey) {
      const isGptOss = selectedModel === "gpt-oss";
      const is8b = selectedModel.includes("8b");
      providerName = isGptOss ? "GPT OSS (Groq)" : is8b ? "Groq Llama 3.1 8B" : "Groq Llama 4 Scout";
      const model = isGptOss ? "openai/gpt-4o-mini" :
                    is8b ? "llama-3.1-8b-instant" :
                    "meta-llama/llama-4-scout-17b-16e-instruct";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
      const data = await res.json();
      content = data.choices?.[0]?.message?.content || "";
    }
    // OpenRouter — acesso a centenas de modelos
    else if (isOpenRouter && openrouterApiKey) {
      providerName = "OpenRouter";
      const model = selectedModel === "openrouter"
        ? "deepseek/deepseek-chat:free"
        : selectedModel;
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterApiKey}`,
          "HTTP-Referer": "https://iaprogramador.online",
          "X-Title": "IAProgramador",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter error: ${await res.text()}`);
      const data = await res.json();
      content = data.choices?.[0]?.message?.content || "";
    }
    // Claude (Anthropic) — Haiku, Sonnet e Opus
    else if (isClaude && anthropicApiKey) {
      const isOpus = selectedModel.includes("opus");
      const isHaiku = selectedModel.includes("haiku");
      providerName = isOpus ? "Claude Opus 4.6" : isHaiku ? "Claude Haiku 4.5" : "Claude Sonnet 4.5";
      const model = isOpus ? "claude-opus-4-6" : isHaiku ? "claude-haiku-4-5" : "claude-sonnet-4-5";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: messages.map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });
      if (!res.ok) throw new Error(`Claude error: ${await res.text()}`);
      const data = await res.json();
      content = data.content?.[0]?.text || "";
    }
    // Gemini (default)
    else {
      if (!geminiApiKey) {
        return new Response(JSON.stringify({ error: "AI not configured - GEMINI_API_KEY missing" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      providerName = "Gemini";
      const geminiModel = selectedModel.includes("pro") ? "gemini-1.5-pro" : "gemini-1.5-flash";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
      const geminiContents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      geminiContents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: geminiContents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
      });
      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido no Gemini. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: `Gemini error (${response.status}): ${errText.substring(0, 200)}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const aiResult = await response.json();
      content = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    
    // Gemini doesn't return token counts directly, estimate based on characters
    const inputTokens = estimatedInputTokens;
    const outputTokens = Math.ceil(content.length / 4) || estimatedOutputTokens;

    // Calculate actual cost based on real usage
    const actualCostCents = Math.max(
      Math.ceil(
        (inputTokens / 1_000_000) * resaleInput +
        (outputTokens / 1_000_000) * resaleOutput
      ),
      20
    );

    // Deduct from balance and log usage (fire-and-forget)
    try {
      const [balanceUpdate, usageInsert] = await Promise.all([
        supabaseAdmin.from("balances").update({
          balance_cents: currentBalance - actualCostCents,
          total_spent_cents: (balance as any).total_spent_cents
            ? (balance as any).total_spent_cents + actualCostCents
            : actualCostCents,
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
      
      if (balanceUpdate.error) {
        console.error("Balance update error:", balanceUpdate.error);
      }
      if (usageInsert.error) {
        console.error("Token usage insert error:", usageInsert.error);
      }
    } catch (dbError) {
      console.error("Database operation error:", dbError);
      // Não falhar a requisição se o DB falhar, mas logar o erro
    }

    console.log(`Response sent to user ${user.id}: ${content.length} chars, cost R$ ${(actualCostCents / 100).toFixed(2)}`);
    
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
