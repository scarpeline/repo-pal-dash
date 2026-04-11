import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for GET action (withdrawals list)
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "withdrawals") {
      const { data: withdrawals } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ withdrawals: withdrawals || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const bodyAction = body.action;

    // Handle admin verification code
    if (bodyAction === "send-admin-code") {
      const { email, code, userEmail, timestamp } = body;
      
      if (!email || !code) {
        return new Response(
          JSON.stringify({ error: "Missing email or code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get Resend API key
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      if (!resendApiKey) {
        // Return success but note that email wasn't sent
        return new Response(
          JSON.stringify({ 
            ok: true, 
            sent: false, 
            message: "RESEND_API_KEY not configured. Code generated but email not sent.",
            code: code 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send email via Resend
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "IAProgramador <noreply@iaprogramador.online>",
            to: [email],
            subject: "🔐 Código de Acesso - Super Admin",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">🔐 Código de Acesso Super Admin</h2>
                <p>Olá,</p>
                <p>Foi solicitado um código de acesso ao painel Super Admin.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <p style="font-size: 32px; font-weight: bold; color: #ff6b35; margin: 0; letter-spacing: 8px;">${code}</p>
                </div>
                <p><strong>Detalhes do acesso:</strong></p>
                <ul>
                  <li>Email que solicitou: ${userEmail || "Não identificado"}</li>
                  <li>Data/Hora: ${timestamp || new Date().toISOString()}</li>
                </ul>
                <p style="color: #666; font-size: 12px;">Este código expira em 10 minutos.</p>
                <p style="color: #666; font-size: 12px;">Se você não solicitou este código, ignore este email.</p>
              </div>
            `,
          }),
        });

        if (!emailRes.ok) {
          const errorData = await emailRes.text();
          console.error("Resend API error:", errorData);
          console.error("Resend status:", emailRes.status);
          return new Response(
            JSON.stringify({ 
              ok: true, 
              sent: false, 
              message: `Resend API error (${emailRes.status}): ${errorData}. Verifique: 1) Se RESEND_API_KEY está configurada nas variáveis de ambiente do projeto, 2) Se o domínio iaprogramador.online está verificado no Resend dashboard.`,
              code: code 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ ok: true, sent: true, message: "Email sent successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
        return new Response(
          JSON.stringify({ 
            ok: true, 
            sent: false, 
            message: "Email send failed. Code generated but email not sent.",
            code: code 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle regular notifications
    const { userId, user_ids: rawUserIds, title, message } = body;

    // Aceita tanto userId (string) quanto user_ids (array) para compatibilidade
    const user_ids: string[] = rawUserIds
      ? rawUserIds
      : userId
        ? [userId]
        : [];

    if (user_ids.length === 0 || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing userId/user_ids, title, or message" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert in-app notifications
    const rows = user_ids.map((uid: string) => ({
      user_id: uid,
      title,
      message,
      read: false,
      sent_by_email: false,
    }));

    const { error } = await supabase.from("notifications").insert(rows);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, sent: user_ids.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
