const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET /github-oauth?action=login → redirect to GitHub
  if (req.method === "GET" && url.searchParams.get("action") === "login") {
    const clientId = Deno.env.get("GITHUB_CLIENT_ID");
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    if (!clientId) {
      return new Response("OAuth not configured", { status: 500 });
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "repo",
    });
    return new Response(null, {
      status: 302,
      headers: { Location: `https://github.com/login/oauth/authorize?${params}` },
    });
  }

  // POST /github-oauth → exchange code for token
  if (req.method === "POST") {
    try {
      const { code } = await req.json();
      if (!code || typeof code !== "string") {
        return new Response(JSON.stringify({ error: "Missing code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientId = Deno.env.get("GITHUB_CLIENT_ID");
      const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "OAuth not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" },
      });

      if (!userRes.ok) {
        const body = await userRes.text();
        return new Response(JSON.stringify({ error: "Failed to get user: " + body }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const user = await userRes.json();

      return new Response(
        JSON.stringify({
          access_token: tokenData.access_token,
          user: { login: user.login, avatar_url: user.avatar_url, name: user.name || user.login },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
