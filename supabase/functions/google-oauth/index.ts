import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET /google-oauth?action=get_client_id → return client ID
  if (req.method === "GET" && url.searchParams.get("action") === "get_client_id") {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ client_id: clientId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GET /google-oauth?action=login → redirect to Google
  if (req.method === "GET" && url.searchParams.get("action") === "login") {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const state = url.searchParams.get("state") || "";
    
    if (!clientId) {
      return new Response("Google OAuth not configured", { status: 500 });
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: state,
      access_type: "online",
      prompt: "consent",
    });
    
    return new Response(null, {
      status: 302,
      headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
    });
  }

  // POST /google-oauth → exchange code for token
  if (req.method === "POST") {
    try {
      const { code, redirect_uri } = await req.json();
      if (!code || typeof code !== "string") {
        return new Response(JSON.stringify({ error: "Missing code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Exchange code for access token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirect_uri || "",
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user info
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userRes.ok) {
        const body = await userRes.text();
        return new Response(JSON.stringify({ error: "Failed to get user: " + body }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const user = await userRes.json();

      // --- Supabase Admin: find-or-create user and generate session token ---
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // Try to create user (silently ignores if already exists)
      await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          full_name: user.name || user.email,
          avatar_url: user.picture,
          provider: "google",
        },
      });

      // Generate a magic-link token (does NOT send an email)
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
      });

      if (linkError || !linkData?.properties?.email_otp) {
        return new Response(
          JSON.stringify({ error: "Failed to generate auth token: " + (linkError?.message || "unknown") }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          user: { 
            id: user.id,
            email: user.email, 
            name: user.name || user.email,
            picture: user.picture,
          },
          email_otp: linkData.properties.email_otp,
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
