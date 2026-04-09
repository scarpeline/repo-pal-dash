import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

      const googleUser = await userRes.json();

      // --- Server-side auth: create/find user and generate OTP ---
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // Check if user exists by email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email === googleUser.email
      );

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        // Update user metadata with Google info
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: googleUser.name || existingUser.user_metadata?.full_name,
            avatar_url: googleUser.picture || existingUser.user_metadata?.avatar_url,
            provider: "google",
          },
        });
      } else {
        // Create new user with auto-confirmed email
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: googleUser.email,
          email_confirm: true,
          user_metadata: {
            full_name: googleUser.name || googleUser.email,
            avatar_url: googleUser.picture,
            provider: "google",
          },
        });
        if (createError || !newUser?.user) {
          return new Response(JSON.stringify({ error: "Erro ao criar usuário: " + (createError?.message || "desconhecido") }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = newUser.user.id;
      }

      // Generate a magic link token (OTP) for the user — no email sent
      const { data: otpData, error: otpError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: googleUser.email,
      });

      if (otpError || !otpData) {
        return new Response(JSON.stringify({ error: "Erro ao gerar token: " + (otpError?.message || "desconhecido") }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract the OTP token from the link
      const linkUrl = new URL(otpData.properties?.action_link || "");
      const otpToken = linkUrl.searchParams.get("token") || "";
      const otpType = linkUrl.searchParams.get("type") || "magiclink";

      return new Response(
        JSON.stringify({
          user: { 
            id: googleUser.id,
            email: googleUser.email, 
            name: googleUser.name || googleUser.email,
            picture: googleUser.picture,
          },
          otp_token: otpToken,
          otp_type: otpType,
          user_id: userId,
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
