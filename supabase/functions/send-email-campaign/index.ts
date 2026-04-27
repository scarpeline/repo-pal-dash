import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRecipient {
  email: string;
  name?: string;
  user_id?: string;
}

interface CampaignPayload {
  subject: string;
  html_content: string;
  text_content?: string;
  from_name?: string;
  from_email?: string;
  recipient_filter?: "all" | "paid" | "unpaid" | "active" | "inactive" | "custom";
  custom_emails?: string[];
  test_mode?: boolean;
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  fromName: string,
  fromEmail: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ""),
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      return { success: false, error: `Resend error: ${errorData}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function getRecipients(
  supabase: any,
  filter: string,
  customEmails?: string[]
): Promise<EmailRecipient[]> {
  if (filter === "custom" && customEmails) {
    return customEmails.map(email => ({ email }));
  }

  let query = supabase
    .from("profiles")
    .select("id, email, full_name");

  // Filtros
  if (filter === "paid") {
    const { data: paidUsers } = await supabase
      .from("lead_captures")
      .select("user_id")
      .eq("has_paid", true);
    
    const paidIds = paidUsers?.map((u: any) => u.user_id) || [];
    if (paidIds.length === 0) return [];
    query = query.in("id", paidIds);
  } else if (filter === "unpaid") {
    const { data: unpaidUsers } = await supabase
      .from("lead_captures")
      .select("user_id")
      .eq("has_paid", false);
    
    const unpaidIds = unpaidUsers?.map((u: any) => u.user_id) || [];
    if (unpaidIds.length === 0) return [];
    query = query.in("id", unpaidIds);
  } else if (filter === "active") {
    // Usuários que fizeram login nos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: activeUsers } = await supabase
      .from("lead_captures")
      .select("user_id")
      .gte("last_login_at", thirtyDaysAgo.toISOString());
    
    const activeIds = activeUsers?.map((u: any) => u.user_id) || [];
    if (activeIds.length === 0) return [];
    query = query.in("id", activeIds);
  } else if (filter === "inactive") {
    // Usuários que não fizeram login nos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: inactiveUsers } = await supabase
      .from("lead_captures")
      .select("user_id")
      .lt("last_login_at", thirtyDaysAgo.toISOString());
    
    const inactiveIds = inactiveUsers?.map((u: any) => u.user_id) || [];
    if (inactiveIds.length === 0) return [];
    query = query.in("id", inactiveIds);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  
  return (data || []).map((p: any) => ({
    email: p.email,
    name: p.full_name,
    user_id: p.id,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();
    
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── GET RECIPIENTS COUNT ──
    if (action === "count") {
      const filter = url.searchParams.get("filter") || "all";
      const recipients = await getRecipients(supabase, filter);
      
      return new Response(
        JSON.stringify({ count: recipients.length }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── SEND CAMPAIGN ──
    if (action === "send") {
      const payload: CampaignPayload = await req.json();
      
      const {
        subject,
        html_content,
        text_content,
        from_name = "IAProgramador",
        from_email = "noreply@iaprogramador.online",
        recipient_filter = "all",
        custom_emails,
        test_mode = false,
      } = payload;

      if (!subject || !html_content) {
        return new Response(
          JSON.stringify({ error: "Subject and html_content are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Buscar destinatários
      const recipients = await getRecipients(
        supabase,
        recipient_filter,
        custom_emails
      );

      if (recipients.length === 0) {
        return new Response(
          JSON.stringify({ error: "No recipients found" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Modo teste: enviar apenas para o admin
      const finalRecipients = test_mode 
        ? [{ email: user.email!, name: "Admin (Test)", user_id: user.id }]
        : recipients;

      // Criar registro da campanha
      const { data: campaign, error: campaignError } = await supabase
        .from("email_campaigns")
        .insert({
          subject,
          html_content,
          text_content,
          from_name,
          from_email,
          recipient_filter,
          recipient_count: finalRecipients.length,
          sent_by: user.id,
          status: "sending",
          test_mode,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Enviar emails (em lote de 10 por vez para não sobrecarregar)
      const results = {
        total: finalRecipients.length,
        sent: 0,
        failed: 0,
        errors: [] as string[],
      };

      const batchSize = 10;
      for (let i = 0; i < finalRecipients.length; i += batchSize) {
        const batch = finalRecipients.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (recipient) => {
            // Personalizar email com nome do usuário
            let personalizedHtml = html_content.replace(
              /\{\{name\}\}/g,
              recipient.name || "Usuário"
            );
            personalizedHtml = personalizedHtml.replace(
              /\{\{email\}\}/g,
              recipient.email
            );

            const result = await sendEmail(
              recipient.email,
              subject,
              personalizedHtml,
              text_content || "",
              from_name,
              from_email
            );

            if (result.success) {
              results.sent++;
              
              // Registrar envio
              await supabase.from("email_logs").insert({
                campaign_id: campaign.id,
                recipient_email: recipient.email,
                recipient_user_id: recipient.user_id,
                status: "sent",
                sent_at: new Date().toISOString(),
              });
            } else {
              results.failed++;
              results.errors.push(`${recipient.email}: ${result.error}`);
              
              // Registrar falha
              await supabase.from("email_logs").insert({
                campaign_id: campaign.id,
                recipient_email: recipient.email,
                recipient_user_id: recipient.user_id,
                status: "failed",
                error_message: result.error,
              });
            }
          })
        );

        // Pequeno delay entre lotes
        if (i + batchSize < finalRecipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Atualizar status da campanha
      await supabase
        .from("email_campaigns")
        .update({
          status: "completed",
          sent_count: results.sent,
          failed_count: results.failed,
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);

      return new Response(
        JSON.stringify({
          success: true,
          campaign_id: campaign.id,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── GET CAMPAIGNS ──
    if (action === "list") {
      const { data: campaigns } = await supabase
        .from("email_campaigns")
        .select("*, profiles(email, full_name)")
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(
        JSON.stringify({ campaigns: campaigns || [] }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── GET CAMPAIGN DETAILS ──
    if (action === "details") {
      const campaignId = url.searchParams.get("campaign_id");
      
      if (!campaignId) {
        return new Response(
          JSON.stringify({ error: "campaign_id required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const [campaignRes, logsRes] = await Promise.all([
        supabase
          .from("email_campaigns")
          .select("*, profiles(email, full_name)")
          .eq("id", campaignId)
          .single(),
        supabase
          .from("email_logs")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("sent_at", { ascending: false }),
      ]);

      return new Response(
        JSON.stringify({
          campaign: campaignRes.data,
          logs: logsRes.data || [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-email-campaign error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
