import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Aceita UPPER_SNAKE ou minúsculo (ex.: `openai_api_key` no painel). */
function envFirst(...names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v !== undefined && String(v).trim() !== "") return v;
  }
  return undefined;
}

const MIN_CHAT_CHARGE_CENTS = 1;

const GOOGLE_MODEL_BY_ID: Record<string, string> = {
  "gemini": "google/gemini-3-flash-preview",
  "google-code-fast": "google/gemini-3-flash-preview",
  "google-code-balanced": "google/gemini-2.5-flash",
  "google-code-pro": "google/gemini-2.5-pro",
  "google-image": "google/gemini-3.1-flash-image-preview",
  "google-video": "google/gemini-3.1-pro-preview",
};

const MODEL_ID_BY_SHORT_ID: Record<string, string> = {
  "auto": "google/gemini-3-flash-preview",
  "gemini": "google/gemini-3-flash-preview",
  "google-code-fast": "google/gemini-3-flash-preview",
  "google-code-balanced": "google/gemini-2.5-flash",
  "google-code-pro": "google/gemini-2.5-pro",
  "google-image": "google/gemini-3.1-flash-image-preview",
  "google-video": "google/gemini-3.1-pro-preview",
  "deepseek": "deepseek/deepseek-chat",
  "groq": "groq/llama-4-scout",
  "groq-8b": "groq/llama-3.1-8b",
  "kimi": "moonshot/kimi-k2-0711-preview",
  "openrouter": "openrouter/deepseek-free",
  "claude-haiku": "anthropic/claude-haiku-4-5",
  "claude-sonnet": "anthropic/claude-sonnet-4-6",
  "claude-opus": "anthropic/claude-opus-4-1",
  "openai": "openai/gpt-5-nano",
};

const shortIdToPricingModel = (shortId: string) => MODEL_ID_BY_SHORT_ID[shortId] || MODEL_ID_BY_SHORT_ID["google-code-fast"];

const DIRECT_GEMINI_MODEL_BY_ID: Record<string, string> = {
  "gemini": "gemini-2.5-flash",
  "google-code-fast": "gemini-2.5-flash",
  "google-code-balanced": "gemini-2.5-flash",
  "google-code-pro": "gemini-2.5-pro",
  "google-video": "gemini-2.5-pro",
};

const isGoogleRoute = (id: string) => Boolean(GOOGLE_MODEL_BY_ID[id]);

/** Modo auto: escolhe modelo Google conforme tarefa, evitando provedores quebrados e consumo desnecessário. */
function pickAutoModel(messages: any[], fileContent?: string): string {
  const lastUser = String(
    [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "",
  );
  const blob = messages.map((m: any) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const scan = (lastUser + "\n" + blob).slice(-24_000).toLowerCase();

  const codeScore = [
    /```/.test(lastUser),
    /\b(function|const|class|import|export|def |\basync\b|interface|type |\bhook\b)\b/.test(scan),
    /\.(tsx?|jsx?|vue|py|go|rs)\b/.test(scan),
    /\b(sql|prisma|supabase|endpoint|api rest|graphql)\b/.test(scan),
  ].filter(Boolean).length;

  const expert =
    /\b(refator|arquitetura|segurança|owasp|performance|codebase|projeto inteiro|multi[- ]?arquivo|complex)\b/i.test(
      lastUser,
    ) || lastUser.length > 4000 || (fileContent?.length ?? 0) > 14_000;

  const longCtx = (fileContent?.length ?? 0) > 7000 || messages.length > 10 || lastUser.length > 3000;

  const tiny = lastUser.length < 160 && codeScore === 0 && !(fileContent && fileContent.length > 400);

  if (/\b(imagem|image|foto|logo|banner|ilustra|desenho|arte|thumbnail)\b/i.test(lastUser)) return "google-image";
  if (/\b(vídeo|video|remotion|motion|animaç|mp4|reel|shorts|storyboard)\b/i.test(lastUser)) return "google-video";
  if (expert || longCtx) return "google-code-pro";
  if (codeScore >= 1 && !tiny) return "google-code-balanced";
  return "google-code-fast";
}

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
      const geminiKey = envFirst("GEMINI_API_KEY", "gemini_api_key");
      const deepseekKey = envFirst("DEEPSEEK_API_KEY", "deepseek_api_key");
      const kimiKey = envFirst("KIMI_API_KEY", "kimi_api_key");
      const groqKey = envFirst("GROQ_API_KEY", "groq_api_key");

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
          results.gemini = { balance: res.ok ? "Key válida" : null, error: res.ok ? null : `HTTP ${res.status}`, currency: "USD" };
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
    // O frontend envia IDs curtos. Mantemos rotas Google válidas para evitar modelos depreciados.
    const rawModel = body.model || "auto";
    
    // Map any full model path back to short ID
    const fullPathToShortId: Record<string, string> = {
      "google/gemini-2.5-flash": "google-code-balanced",
      "google/gemini-3-flash-preview": "google-code-fast",
      "google/gemini-2.5-pro": "google-code-pro",
      "google/gemini-3.1-flash-image-preview": "google-image",
      "google/gemini-3.1-pro-preview": "google-video",
      "deepseek/deepseek-chat": "deepseek",
      "deepseek/deepseek-coder": "deepseek",
      "groq/llama-4-scout": "groq",
      "groq/llama-3.1-8b": "groq-8b",
      
      "moonshot/kimi-k2-0711-preview": "kimi",
      "moonshot/moonshot-v1-32k": "kimi",
      "openrouter/deepseek-free": "openrouter",
      "anthropic/claude-haiku-4-5": "claude-haiku",
      "anthropic/claude-sonnet-4-6": "claude-sonnet",
      "anthropic/claude-sonnet-4-5": "claude-sonnet",
      "anthropic/claude-opus-4-1": "claude-opus",
      "anthropic/claude-opus-4-6": "claude-opus",
      "openai/gpt-4o-mini": "openai",
      "openai/gpt-5-nano": "openai",
    };

    const selectedModel = fullPathToShortId[rawModel] || rawModel;
    let routedModel = selectedModel === "auto"
      ? pickAutoModel(messages, fileContent)
      : selectedModel;

    const { data: activeModelsData } = await supabaseAdmin
      .from("ai_model_pricing")
      .select("model_id")
      .eq("is_active", true);
    const activePricingModelIds = new Set((activeModelsData || []).map((m: any) => m.model_id));
    const isShortIdActive = (shortId: string) => activePricingModelIds.has(shortIdToPricingModel(shortId));

    if (!isShortIdActive(routedModel)) {
      if (selectedModel !== "auto") {
        return new Response(JSON.stringify({ error: "Este modelo de IA está desativado pelo Super Admin." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      routedModel = ["google-code-fast", "google-code-balanced", "google-code-pro", "gemini", "openai"].find(isShortIdActive) || "google-code-fast";
    }

    // ── Map short ID to pricing model_id (cada modelo cobra conforme linha em ai_model_pricing) ──
    const pricingModelId = shortIdToPricingModel(routedModel);

    console.log("ai-chat request:", {
      userId: user.id,
      rawModel,
      selectedModel,
      routedModel,
      auto: selectedModel === "auto",
      messageCount: messages?.length,
    });

    // Fetch resale pricing do modelo que será chamado (não usar “o mais caro” como fallback)
    const { data: pricing } = await supabaseAdmin
      .from("ai_model_pricing")
      .select("resale_price_input_per_million, resale_price_output_per_million, model_label")
      .eq("model_id", pricingModelId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: fallbackPricing } = !pricing
      ? await supabaseAdmin
        .from("ai_model_pricing")
        .select("resale_price_input_per_million, resale_price_output_per_million")
        .eq("model_id", "google/gemini-3-flash-preview")
        .eq("is_active", true)
        .maybeSingle()
      : { data: null };

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
    const minCharge = Math.max(estimatedCostCents, MIN_CHAT_CHARGE_CENTS);

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

    const geminiApiKey = envFirst("GEMINI_API_KEY", "gemini_api_key");
    const deepseekApiKey = envFirst("DEEPSEEK_API_KEY", "deepseek_api_key");
    const kimiApiKey = envFirst("KIMI_API_KEY", "kimi_api_key");
    const groqApiKey = envFirst("GROQ_API_KEY", "groq_api_key");
    const openrouterApiKey = envFirst("OPENROUTER_API_KEY", "openrouter_api_key");
    const anthropicApiKey = envFirst("ANTHROPIC_API_KEY", "anthropic_api_key");
    const openaiDirectKey = envFirst("OPENAI_API_KEY", "openai_api_key", "openai_API_KEY");
    const lovableGatewayKey = envFirst("LOVABLE_API_KEY", "lovable_api_key");

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

    // ── APIs compatíveis OpenAI (chat/completions) ──
    const callOpenAICompatible = async (
      url: string,
      apiKey: string,
      modelName: string,
      extraHeaders: Record<string, string> = {},
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
        const errBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 180)}`);
      }
      const data = await res.json();
      if (data.error && (data.error.message || data.error.code)) {
        throw new Error(
          String(data.error.message || data.error.code || JSON.stringify(data.error)).substring(0, 180),
        );
      }
      const text = data.choices?.[0]?.message?.content || "";
      if (!String(text).trim()) throw new Error("Resposta vazia");
      return text;
    };

    const modelDisplayName: Record<string, string> = {
      gemini: "Google Gemini Flash",
      "google-code-fast": "Google Gemini 3 Flash",
      "google-code-balanced": "Google Gemini 2.5 Flash",
      "google-code-pro": "Google Gemini 2.5 Pro",
      "google-image": "Google Gemini Imagem",
      "google-video": "Google Gemini Vídeo",
      "groq-8b": "Llama 3.1 8B (Groq)",
      groq: "Llama 4 Scout (Groq)",
      deepseek: "DeepSeek",
      openrouter: "OpenRouter",
      "claude-haiku": "Claude Haiku 4.5",
      "claude-sonnet": "Claude Sonnet 4.6",
      "claude-opus": "Claude Opus",
      kimi: "Kimi K2",
      openai: "GPT-5 Nano",
    };

    const claudeApiModel: Record<string, string> = {
      "claude-haiku": "claude-3-5-haiku-latest",
      "claude-sonnet": "claude-sonnet-4-5",
      "claude-opus": "claude-opus-4-1",
    };

    const canAttempt = (mid: string): boolean => {
      if (isGoogleRoute(mid)) return !!(lovableGatewayKey || geminiApiKey);
      switch (mid) {
        case "gemini":
          return !!geminiApiKey;
        case "deepseek":
          return !!deepseekApiKey;
        case "kimi":
          return !!kimiApiKey;
        case "groq":
        case "groq-8b":
          return !!groqApiKey;
        case "openrouter":
          return !!openrouterApiKey;
        case "claude-haiku":
        case "claude-sonnet":
        case "claude-opus":
          return !!anthropicApiKey;
        case "openai":
          return !!(openaiDirectKey || lovableGatewayKey);
        default:
          return false;
      }
    };

    const runGemini = async (mid = "gemini"): Promise<string> => {
      if (lovableGatewayKey) {
        const modelName = GOOGLE_MODEL_BY_ID[mid] || GOOGLE_MODEL_BY_ID.gemini;
        const wantsImage = mid === "google-image";
        const promptMessages = [{ role: "system", content: systemPrompt }, ...messages];
        const res = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableGatewayKey}` },
          body: JSON.stringify({
            model: modelName,
            messages: promptMessages,
            temperature: 0.4,
            max_tokens: 4096,
            ...(wantsImage ? { modalities: ["image", "text"] } : {}),
          }),
        }, 45_000);
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Lovable AI ${res.status}: ${errBody.substring(0, 180)}`);
        }
        const data = await res.json();
        if (data.error && (data.error.message || data.error.code)) {
          throw new Error(String(data.error.message || data.error.code).substring(0, 180));
        }
        const text = data.choices?.[0]?.message?.content || "";
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imageUrl) return `${text || "Imagem gerada com sucesso."}\n\n![Imagem gerada](${imageUrl})`;
        if (!String(text).trim()) throw new Error("Lovable AI resposta vazia");
        return text;
      }

      if (!geminiApiKey) throw new Error("Gemini sem chave");
      if (mid === "google-image") throw new Error("Geração de imagem requer Lovable AI configurado");
      const geminiUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/${DIRECT_GEMINI_MODEL_BY_ID[mid] || DIRECT_GEMINI_MODEL_BY_ID.gemini}:generateContent?key=${geminiApiKey}`;
      const geminiContents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      geminiContents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
      const response = await fetchWithTimeout(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini ${response.status}: ${errText.substring(0, 180)}`);
      }
      const aiResult = await response.json();
      if (aiResult.error) {
        const em =
          aiResult.error.message ||
          aiResult.error.status ||
          JSON.stringify(aiResult.error);
        throw new Error(`Gemini: ${String(em).substring(0, 180)}`);
      }
      const pf = aiResult.promptFeedback;
      if (pf?.blockReason) {
        const brm = pf.blockReasonMessage ? ` (${String(pf.blockReasonMessage)})` : "";
        throw new Error(`Gemini bloqueado: ${pf.blockReason}${brm}`.substring(0, 180));
      }
      const text = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!String(text).trim()) throw new Error("Gemini resposta vazia");
      return text;
    };

    const runClaude = async (mid: string): Promise<string> => {
      if (!anthropicApiKey) throw new Error("Claude sem chave");
      const apiModel = claudeApiModel[mid];
      if (!apiModel) throw new Error("Claude modelo inválido");
      const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: apiModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages.map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Claude ${res.status}: ${t.substring(0, 180)}`);
      }
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      if (!String(text).trim()) throw new Error("Claude resposta vazia");
      return text;
    };

    const runGroq = async (mid: "groq" | "groq-8b"): Promise<string> => {
      if (!groqApiKey) throw new Error("Groq sem chave");
      const groqModelMap: Record<string, string> = {
        groq: "meta-llama/llama-4-scout-17b-16e-instruct",
        "groq-8b": "llama-3.1-8b-instant",
      };
      return callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        groqApiKey,
        groqModelMap[mid],
      );
    };

    const runOpenAI = async (): Promise<string> => {
      if (openaiDirectKey) {
        return callOpenAICompatible(
          "https://api.openai.com/v1/chat/completions",
          openaiDirectKey,
          "gpt-4o-mini",
        );
      }
      if (lovableGatewayKey) {
        return callOpenAICompatible(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          lovableGatewayKey,
          "openai/gpt-5-nano",
        );
      }
      throw new Error("OpenAI sem chave");
    };

    const runOne = async (mid: string): Promise<string> => {
      if (isGoogleRoute(mid)) return await runGemini(mid);
      switch (mid) {
        case "gemini":
          return await runGemini("gemini");
        case "deepseek":
          return await callOpenAICompatible(
            "https://api.deepseek.com/v1/chat/completions",
            deepseekApiKey!,
            "deepseek-coder",
          );
        case "kimi":
          return await callOpenAICompatible(
            "https://api.moonshot.cn/v1/chat/completions",
            kimiApiKey!,
            "moonshot-v1-32k",
          );
        case "groq":
          return await runGroq("groq");
        case "groq-8b":
          return await runGroq("groq-8b");
        case "openrouter":
          return await callOpenAICompatible(
            "https://openrouter.ai/api/v1/chat/completions",
            openrouterApiKey!,
            "deepseek/deepseek-chat:free",
            { "HTTP-Referer": "https://iaprogramador.online", "X-Title": "IAProgramador" },
          );
        case "claude-haiku":
        case "claude-sonnet":
        case "claude-opus":
          return await runClaude(mid);
        case "openai":
          return await runOpenAI();
        default:
          if (canAttempt("gemini")) return await runGemini();
          throw new Error(`Modelo não suportado: ${mid}`);
      }
    };

    /** Ordem após o preferido: openai cedo (Lovable/OpenAI costuma existir quando Gemini falha por quota). */
    const FALLBACK_ORDER = [
      "google-code-fast",
      "google-code-balanced",
      "gemini",
      "openai",
      "groq-8b",
      "groq",
      "deepseek",
      "openrouter",
      "claude-haiku",
      "kimi",
      "claude-sonnet",
      "claude-opus",
    ];

    const preferred = [routedModel, ...FALLBACK_ORDER.filter((m) => m !== routedModel)];
    const attemptModels = [...new Set(preferred)].filter(canAttempt);

    let content = "";
    let providerName = "—";
    let billingShortId = routedModel;
    let usedFallback = false;
    let lastError = "";
    const tried: string[] = [];

    if (attemptModels.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhuma integração de IA disponível no servidor. Configure as chaves de IA ou aguarde o Lovable AI ficar disponível.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const mid of attemptModels) {
      tried.push(mid);
      try {
        const text = await runOne(mid);
        content = text;
        billingShortId = mid;
        providerName = modelDisplayName[mid] || mid;
        usedFallback = mid !== routedModel;
        if (usedFallback) {
          const wanted = modelDisplayName[routedModel] || routedModel;
          content =
            `_*${wanted}* não respondeu; esta mensagem foi gerada com **${providerName}**._\n\n${content}`;
        }
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.warn(`ai-chat modelo ${mid} falhou:`, lastError);
      }
    }

    if (!content) {
      return new Response(
        JSON.stringify({
          error: `Nenhuma IA respondeu após tentar: ${tried.join(", ")}. Último erro: ${lastError}`,
          tried_models: tried,
          last_model_error: lastError,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Calculate cost based on ACTUAL model used (fallback-aware) ──
    const inputTokens  = estimatedInputTokens;
    const outputTokens = Math.max(Math.ceil(content.length / 4), 100);

    const billedPricingModelId = shortIdToPricingModel(billingShortId);
    const { data: billedResale } = await supabaseAdmin
      .from("ai_model_pricing")
      .select("resale_price_input_per_million, resale_price_output_per_million")
      .eq("model_id", billedPricingModelId)
      .eq("is_active", true)
      .maybeSingle();

    const billResaleIn  = billedResale?.resale_price_input_per_million  ?? 50;
    const billResaleOut = billedResale?.resale_price_output_per_million ?? 200;

    const actualCostCents = Math.max(
      Math.ceil(
        (inputTokens  / 1_000_000) * billResaleIn +
        (outputTokens / 1_000_000) * billResaleOut
      ),
      MIN_CHAT_CHARGE_CENTS
    );

    // ── Re-verificar saldo se houve fallback (preço pode ser diferente) ──
    if (usedFallback && actualCostCents > minCharge) {
      if (currentBalance < actualCostCents) {
        return new Response(
          JSON.stringify({
            error: `Saldo insuficiente para o modelo de fallback. Seu saldo: R$ ${(currentBalance / 100).toFixed(2)}. Custo real: R$ ${(actualCostCents / 100).toFixed(2)}.`,
            code: "INSUFFICIENT_BALANCE_FALLBACK",
            currentBalance,
            requiredAmount: actualCostCents,
            fallback_model: billingShortId,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: apiPricing } = await supabaseAdmin
      .from("ai_model_pricing")
      .select("api_cost_input_per_million, api_cost_output_per_million")
      .eq("model_id", billedPricingModelId)
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

    console.log(`Cobrança: ${inputTokens}+${outputTokens} tokens | faturado como ${billingShortId} (${providerName}) | revenda: R$${(actualCostCents/100).toFixed(4)} | custo API: R$${(apiCostCents/100).toFixed(4)}`);

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
          model: billingShortId,
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
      model: billingShortId,
      routing: {
        user_choice: selectedModel,
        resolved: routedModel,
        billed: billingShortId,
        used_fallback: usedFallback,
        tried_models: tried,
      },
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
