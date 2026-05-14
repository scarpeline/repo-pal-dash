import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { projectId, codeSnippet, agentType } = await req.json();

    // Specialized agents logic
    let analysis = [];
    if (agentType === "backend") {
      analysis = [
        { type: "SQL Injection", severity: "high", description: "Possible SQL injection in query building." },
        { type: "JWT Insecurity", severity: "medium", description: "Hardcoded secret or weak algorithm." }
      ];
    } else if (agentType === "frontend") {
      analysis = [
        { type: "XSS", severity: "critical", description: "dangerouslySetInnerHTML used without sanitization." }
      ];
    }

    return new Response(JSON.stringify({ analysis, status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
