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
    const { repositoryUrl, action } = await req.json();

    if (action === "map_architecture") {
      const architecture = {
        frontend: { tech: "React/Vite", files: ["src/", "package.json"], score: 85 },
        backend: { tech: "Node.js/Edge Functions", files: ["supabase/functions/"], score: 90 },
        database: { tech: "PostgreSQL", files: ["supabase/migrations/"], score: 95 },
        devops: { tech: "GitHub Actions", files: [".github/workflows/"], score: 80 },
      };

      return new Response(JSON.stringify({ architecture, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action not supported" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
