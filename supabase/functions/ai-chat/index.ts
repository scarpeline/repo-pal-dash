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

    const { messages, fileContent, fileName, repoName, branch, model } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedModel = model || "google/gemini-3-flash-preview";

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
    if (currentBalance < minCharge) {
      return new Response(
        JSON.stringify({
          error: `Saldo insuficiente. Seu saldo: R$ ${(currentBalance / 100).toFixed(2)}. Custo estimado: R$ ${(minCharge / 100).toFixed(2)}. Recarregue na Carteira.`,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: false, // non-streaming to get usage data
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da plataforma esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Erro de IA: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    const usage = aiResult.usage || {};
    const inputTokens = usage.prompt_tokens || estimatedInputTokens;
    const outputTokens = usage.completion_tokens || estimatedOutputTokens;

    // Calculate actual cost based on real usage
    const actualCostCents = Math.max(
      Math.ceil(
        (inputTokens / 1_000_000) * resaleInput +
        (outputTokens / 1_000_000) * resaleOutput
      ),
      20
    );

    // Deduct from balance and log usage (fire-and-forget)
    await Promise.all([
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

    return new Response(JSON.stringify({
      content,
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
