import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Provider routing ----

interface ProviderConfig {
  name: string;
  apiKeyEnv: string;
  buildRequest: (
    messages: any[],
    systemPrompt: string,
    apiKey: string,
    modelId: string,
  ) => { url: string; init: RequestInit };
  parseResponse: (json: any) => { content: string; inputTokens?: number; outputTokens?: number };
}

function resolveGeminiModel(modelId: string): string {
  if (modelId.includes("3-flash")) return "gemini-2.0-flash";
  if (modelId.includes("2.5-flash")) return "gemini-2.5-flash-preview-04-17";
  if (modelId.includes("2.5-pro")) return "gemini-2.5-pro-preview-03-25";
  if (modelId.includes("flash")) return "gemini-2.0-flash";
  if (modelId.includes("pro")) return "gemini-2.5-pro-preview-03-25";
  return "gemini-2.0-flash";
}

function resolveOpenAIModel(modelId: string): string {
  if (modelId.includes("gpt-5-nano")) return "gpt-4.1-nano";
  if (modelId.includes("gpt-5-mini")) return "gpt-4.1-mini";
  if (modelId.includes("gpt-5")) return "gpt-4.1";
  if (modelId.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (modelId.includes("gpt-4o")) return "gpt-4o";
  return "gpt-4.1-mini";
}

function resolveDeepSeekModel(modelId: string): string {
  if (modelId.includes("reasoner")) return "deepseek-reasoner";
  return "deepseek-chat";
}

function resolveGroqModel(modelId: string): string {
  if (modelId.includes("llama-3.3")) return "llama-3.3-70b-versatile";
  if (modelId.includes("llama-3.1-8b")) return "llama-3.1-8b-instant";
  if (modelId.includes("mixtral")) return "mixtral-8x7b-32768";
  return "llama-3.3-70b-versatile";
}

function resolveMistralModel(modelId: string): string {
  if (modelId.includes("codestral")) return "codestral-latest";
  if (modelId.includes("small")) return "mistral-small-latest";
  if (modelId.includes("medium")) return "mistral-medium-latest";
  return "codestral-latest";
}

function resolveOpenRouterModel(modelId: string): string {
  const afterSlash = modelId.replace("openrouter/", "");
  return afterSlash || "deepseek/deepseek-chat:free";
}

const geminiProvider: ProviderConfig = {
  name: "Gemini",
  apiKeyEnv: "GEMINI_API_KEY",
  buildRequest(messages, systemPrompt, apiKey, modelId) {
    const geminiModel = resolveGeminiModel(modelId);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    contents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
    return {
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }),
      },
    };
  },
  parseResponse(json) {
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { content };
  },
};

function openaiCompatibleProvider(
  name: string,
  apiKeyEnv: string,
  baseUrl: string,
  resolveModel: (id: string) => string,
  extraHeaders?: Record<string, string>,
): ProviderConfig {
  return {
    name,
    apiKeyEnv,
    buildRequest(messages, systemPrompt, apiKey, modelId) {
      const resolvedModel = resolveModel(modelId);
      const url = `${baseUrl}/chat/completions`;
      const allMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ];
      return {
        url,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            ...extraHeaders,
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: allMessages,
            temperature: 0.7,
            max_tokens: 4096,
          }),
        },
      };
    },
    parseResponse(json) {
      const content = json.choices?.[0]?.message?.content || "";
      const usage = json.usage;
      return {
        content,
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
      };
    },
  };
}

const providerRegistry: Record<string, ProviderConfig> = {
  google: geminiProvider,
  openai: openaiCompatibleProvider("OpenAI", "OPENAI_API_KEY", "https://api.openai.com/v1", resolveOpenAIModel),
  deepseek: openaiCompatibleProvider("DeepSeek", "DEEPSEEK_API_KEY", "https://api.deepseek.com/v1", resolveDeepSeekModel),
  groq: openaiCompatibleProvider("Groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1", resolveGroqModel),
  mistral: openaiCompatibleProvider("Mistral", "MISTRAL_API_KEY", "https://api.mistral.ai/v1", resolveMistralModel),
  openrouter: openaiCompatibleProvider("OpenRouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", resolveOpenRouterModel, {
    "HTTP-Referer": "https://iaprogramador.online",
    "X-Title": "IAProgramador",
  }),
};

function getProviderForModel(modelId: string): { provider: ProviderConfig; prefix: string } {
  const prefix = modelId.split("/")[0] || "google";
  const provider = providerRegistry[prefix];
  if (provider) return { provider, prefix };
  return { provider: geminiProvider, prefix: "google" };
}

// ---- Shared call + billing logic ----

async function callProvider(
  provider: ProviderConfig,
  selectedModel: string,
  apiKey: string,
  messages: any[],
  ctx: {
    fileContent?: string;
    fileName?: string;
    repoName?: string;
    branch?: string;
    supabaseAdmin: any;
    user: any;
    balance: any;
    currentBalance: number;
    selectedModel: string;
    resaleInput: number;
    resaleOutput: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  },
): Promise<Response> {
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
    ctx.repoName ? `\n\nRepositório: ${ctx.repoName} (branch: ${ctx.branch || "main"})` : ""
  }${
    ctx.fileName && ctx.fileContent
      ? `\n\nArquivo aberto: ${ctx.fileName}\n\`\`\`\n${ctx.fileContent.substring(0, 8000)}\n\`\`\``
      : ""
  }`;

  const { url, init } = provider.buildRequest(messages, systemPrompt, apiKey, selectedModel);

  console.log(`Calling ${provider.name} (${selectedModel}) ...`);
  const response = await fetch(url, init);

  if (!response.ok) {
    const errText = await response.text();
    console.error(`${provider.name} API error:`, response.status, errText);

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: `Rate limit excedido no ${provider.name}. Tente novamente em alguns segundos.` }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 401 || response.status === 403) {
      return new Response(JSON.stringify({ error: `API Key do ${provider.name} inválida ou sem permissão. Verifique ${provider.apiKeyEnv} nos segredos do Supabase.` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: `Erro na API ${provider.name} (${response.status}): ${errText.substring(0, 200)}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiResult = await response.json();
  const parsed = provider.parseResponse(aiResult);
  const content = parsed.content;

  if (!content) {
    console.error(`Empty content from ${provider.name}:`, aiResult);
    return new Response(JSON.stringify({
      error: "A IA retornou uma resposta vazia. Tente reformular sua pergunta.",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const inputTokens = parsed.inputTokens || ctx.estimatedInputTokens;
  const outputTokens = parsed.outputTokens || Math.ceil(content.length / 4) || ctx.estimatedOutputTokens;

  const actualCostCents = Math.max(
    Math.ceil(
      (inputTokens / 1_000_000) * ctx.resaleInput +
      (outputTokens / 1_000_000) * ctx.resaleOutput
    ),
    20
  );

  try {
    const [balanceUpdate, usageInsert] = await Promise.all([
      ctx.supabaseAdmin.from("balances").update({
        balance_cents: ctx.currentBalance - actualCostCents,
        total_spent_cents: (ctx.balance as any).total_spent_cents
          ? (ctx.balance as any).total_spent_cents + actualCostCents
          : actualCostCents,
        updated_at: new Date().toISOString(),
      }).eq("user_id", ctx.user.id),
      ctx.supabaseAdmin.from("token_usage").insert({
        user_id: ctx.user.id,
        model: ctx.selectedModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_cents: actualCostCents,
      }),
    ]);
    if (balanceUpdate.error) console.error("Balance update error:", balanceUpdate.error);
    if (usageInsert.error) console.error("Token usage insert error:", usageInsert.error);
  } catch (dbError) {
    console.error("Database operation error:", dbError);
  }

  console.log(`Response via ${provider.name} to user ${ctx.user.id}: ${content.length} chars, cost R$ ${(actualCostCents / 100).toFixed(2)}`);

  return new Response(JSON.stringify({
    content,
    provider: provider.name,
    model: selectedModel,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_cents: actualCostCents },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Main handler ----

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

    // ---- Resolve provider and API key ----
    const { provider, prefix } = getProviderForModel(selectedModel);
    let apiKey = Deno.env.get(provider.apiKeyEnv);
    let activeProvider = provider;

    // Fallback: if the selected provider has no key, try Gemini
    if (!apiKey && prefix !== "google") {
      console.warn(`No API key for ${provider.name} (${provider.apiKeyEnv}), falling back to Gemini`);
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) {
        return new Response(JSON.stringify({ error: `Chave de API não configurada para ${provider.name}. Configure ${provider.apiKeyEnv} nos segredos do Supabase.` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      apiKey = geminiKey;
      activeProvider = geminiProvider;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: `Chave de API não configurada: ${provider.apiKeyEnv}. Configure nos segredos do Supabase.` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const billingCtx = {
      fileContent, fileName, repoName, branch,
      supabaseAdmin, user, balance, currentBalance, selectedModel,
      resaleInput, resaleOutput, estimatedInputTokens, estimatedOutputTokens,
    };

    return await callProvider(activeProvider, selectedModel, apiKey, messages, billingCtx);

  } catch (err) {
    console.error("ai-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
