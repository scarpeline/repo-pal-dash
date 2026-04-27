import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── Autenticação obrigatória ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se usuário é admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { command } = await req.json()
    
    const allowedCommands = [
      'git status --porcelain',
      'git add .',
      'git log --oneline -1',
      'git rev-parse HEAD'
    ]
    
    const isAllowed = allowedCommands.some(allowed => 
      command.includes(allowed) || 
      (command.startsWith('git commit -m "') && command.endsWith('"')) ||
      (command === 'git push origin main')
    )
    
    if (!isAllowed) {
      throw new Error('Comando não permitido por segurança')
    }

    const cmd = new Deno.Command(Deno.execPath(), {
      args: ["task", "run-git", command],
      stdout: "piped",
      stderr: "piped"
    })
    
    const { code, stdout, stderr } = await cmd.output()
    
    if (code !== 0) {
      throw new Error(stderr ? new TextDecoder().decode(stderr) : 'Erro ao executar comando')
    }
    
    const output = new TextDecoder().decode(stdout)
    
    return new Response(
      JSON.stringify({ success: true, output: output.trim(), command }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
