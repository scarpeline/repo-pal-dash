import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Constant-time string comparison to mitigate timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { password } = await req.json();
    if (typeof password !== "string" || password.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Senha obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expected = Deno.env.get("SUPERADMIN_PASSWORD") || "";
    if (!expected) {
      return new Response(JSON.stringify({ ok: false, error: "Senha do admin não configurada no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pequeno delay para reduzir brute force
    await new Promise((r) => setTimeout(r, 250));

    const valid = safeEqual(password, expected);
    return new Response(JSON.stringify({ ok: valid }), {
      status: valid ? 200 : 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
