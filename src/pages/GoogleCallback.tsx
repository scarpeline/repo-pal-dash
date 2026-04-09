import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Processando login...");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    // Verificar se é popup
    const isPopup = window.opener !== null;

    if (errorParam) {
      const errorMsg = `Erro do Google: ${errorParam}`;
      setError(errorMsg);
      if (isPopup) {
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeout(() => { window.location.href = "/?error=" + encodeURIComponent(errorParam); }, 2000);
      }
      return;
    }

    if (!code) {
      const errorMsg = "Código de autorização não encontrado";
      setError(errorMsg);
      if (isPopup) {
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeout(() => { window.location.href = "/?error=no_code"; }, 2000);
      }
      return;
    }

    async function exchangeCodeAndLogin() {
      try {
        setStatus("Trocando código por token...");

        // Trocar código por token na Edge Function
        const tokenRes = await fetch(`https://${projectId}.supabase.co/functions/v1/google-oauth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            code,
            redirect_uri: `${window.location.origin}/google/callback`,
          }),
        });

        if (!tokenRes.ok) {
          const errorData = await tokenRes.json().catch(() => ({ error: "Erro desconhecido" }));
          throw new Error(errorData.error || `Erro ${tokenRes.status}`);
        }

        const result = await tokenRes.json();
        const googleUser = result.user;

        if (!googleUser?.email) {
          throw new Error("Email não retornado pelo Google");
        }

        setStatus("Autenticando...");

        // Use OTP token from server to establish Supabase session
        if (result.otp_token) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: result.otp_token,
            type: "magiclink",
          });

          if (verifyError) {
            console.error("OTP verify error:", verifyError);
            throw new Error("Erro ao verificar token de autenticação. Tente novamente.");
          }
        } else {
          throw new Error("Token de autenticação não recebido do servidor.");
        }

        // Update profile with Google data
        if (result.user_id) {
          await supabase.from("profiles").upsert({
            id: result.user_id,
            email: googleUser.email,
            full_name: googleUser.name,
            avatar_url: googleUser.picture,
            updated_at: new Date().toISOString(),
          });
        }

        setStatus("Login realizado!");
        setSuccess(true);
        toast.success("Bem-vindo! Login com Google realizado.");

        // Notificar janela principal
        try {
          if ("BroadcastChannel" in window) {
            const channel = new BroadcastChannel("google-oauth");
            channel.postMessage({ 
              type: "google-connected", 
              user: googleUser,
            });
            channel.close();
          } else if ((window as any).opener) {
            (window as any).opener.postMessage({ 
              type: "google-connected", 
              user: googleUser,
            }, "*");
          }
        } catch (e) {
          // Ignora erros de postMessage
        }

        if (isPopup) {
          setTimeout(() => window.close(), 1500);
        } else {
          // Força reload para garantir que o AuthContext pegue a sessão
          setTimeout(() => { window.location.href = "/"; }, 1200);
        }
      } catch (err: any) {
        console.error("Google callback error:", err);
        const errorMsg = err.message || "Erro ao processar login com Google";
        setError(errorMsg);
        toast.error(errorMsg);
        
        if (isPopup) {
          setTimeout(() => window.close(), 3000);
        } else {
          setTimeout(() => { window.location.href = `/?error=${encodeURIComponent(errorMsg)}`; }, 3000);
        }
      }
    }

    exchangeCodeAndLogin();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {error ? "Erro no Login" : success ? "Sucesso!" : "Processando..."}
          </CardTitle>
          <CardDescription>{status}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          {error ? (
            <XCircle className="w-16 h-16 text-destructive" />
          ) : success ? (
            <CheckCircle2 className="w-16 h-16 text-primary" />
          ) : (
            <Loader2 className="w-16 h-16 animate-spin text-primary" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
