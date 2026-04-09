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
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured - GEMINI_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Map model names to Gemini models
    const geminiModel = selectedModel.includes("flash") 
      ? "gemini-1.5-flash" 
      : "gemini-1.5-pro";
    
    // Call Gemini API directly
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
    
    // Convert messages to Gemini format
    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    
    // Add system prompt as first user message
    geminiContents.unshift({
      role: "user",
      parts: [{ text: systemPrompt }],
    });
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido no Gemini. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 400) {
        // Erro 400 geralmente é problema com a requisição (ex: modelo inválido)
        return new Response(JSON.stringify({ error: `Erro na requisição à API Gemini: ${errText.substring(0, 200)}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ error: "API Key do Gemini inválida ou sem permissão. Verifique a configuração GEMINI_API_KEY no Supabase Secrets." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Qualquer outro erro da API Gemini
      return new Response(JSON.stringify({ error: `Erro na API Gemini (${response.status}): ${errText.substring(0, 200)}. Verifique o console para mais detalhes.` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    console.log("Gemini response received:", { 
      hasCandidates: !!aiResult.candidates,
      candidateCount: aiResult.candidates?.length,
      finishReason: aiResult.candidates?.[0]?.finishReason
    });
    
    // Parse Gemini response format
    const content = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Verificar se houve erro de safety ou outro problema
    const finishReason = aiResult.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.warn("Gemini finish reason:", finishReason, aiResult.candidates?.[0]?.safetyRatings);
    }
    
    if (!content) {
      console.error("Empty content from Gemini:", aiResult);
      return new Response(JSON.stringify({ 
        error: "A IA retornou uma resposta vazia. Tente reformular sua pergunta.",
        details: finishReason ? `Motivo: ${finishReason}` : undefined
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      provider: "Gemini",
      model: geminiModel,
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
