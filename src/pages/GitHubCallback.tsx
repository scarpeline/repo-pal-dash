import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { exchangeCodeForToken, setToken, validateToken } from "@/lib/github";
import { supabase } from "@/integrations/supabase/client";

const GitHubCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("Conectando ao GitHub...");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isPopup = window.name === "github-oauth" || !!window.opener;

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const errorParam = searchParams.get("error");
        if (errorParam) {
          const errorMsg = searchParams.get("error_description") || errorParam;
          setError(errorMsg);
          if (isPopup) setTimeout(() => window.close(), 2000);
          else setTimeout(() => navigate("/?gh_error=" + encodeURIComponent(errorMsg), { replace: true }), 2000);
          return;
        }

        const code = searchParams.get("code");
        if (!code) {
          setError("Código de autorização não encontrado");
          if (isPopup) setTimeout(() => window.close(), 2000);
          else setTimeout(() => navigate("/?gh_error=Código%20ausente", { replace: true }), 2000);
          return;
        }

        setStatus("Trocando código por token...");
        const state = searchParams.get("state");
        const result = await exchangeCodeForToken(code, state || undefined);

        if ("error" in result) {
          setError(result.error);
          if (isPopup) setTimeout(() => window.close(), 2000);
          else setTimeout(() => navigate("/?gh_error=" + encodeURIComponent(result.error), { replace: true }), 2000);
          return;
        }

        setStatus("Validando credenciais...");
        const validation = await validateToken(result.access_token);
        if (!validation.valid) {
          setError("Token inválido");
          if (isPopup) setTimeout(() => window.close(), 2000);
          else setTimeout(() => navigate("/?gh_error=Token%20inválido", { replace: true }), 2000);
          return;
        }

        setToken(result.access_token);
        localStorage.setItem("gh_user", JSON.stringify(result.user));
        setStatus("Conectado!");
        setSuccess(true);

        // Notificar janela principal via BroadcastChannel ou postMessage
        try {
          if ("BroadcastChannel" in window) {
            const channel = new BroadcastChannel("github-oauth");
            channel.postMessage({ type: "github-connected", token: result.access_token, user: result.user });
            channel.close();
          } else if ((window as any).opener) {
            (window as any).opener.postMessage({ type: "github-connected", token: result.access_token, user: result.user }, "*");
          }
        } catch {
          // Fallback para localStorage
        }

        if (isPopup) {
          setTimeout(() => window.close(), 800);
        } else {
          setTimeout(() => navigate("/?gh_connected=1", { replace: true }), 500);
        }
      } catch (err: any) {
        setError(err.message || "Erro desconhecido");
        if (isPopup) setTimeout(() => window.close(), 2000);
        else setTimeout(() => navigate("/?gh_error=" + encodeURIComponent(err.message || "Erro"), { replace: true }), 2000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, isPopup]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md px-4">
        {error ? (
          <>
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-destructive">Erro na Autenticação</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            {isPopup && <p className="text-xs text-muted-foreground">Esta janela fechará automaticamente...</p>}
          </>
        ) : success ? (
          <>
            <CheckCircle className="w-12 h-12 text-[hsl(var(--success))] mx-auto" />
            <p className="text-sm font-semibold text-foreground">Conectado com sucesso!</p>
            {isPopup && <p className="text-xs text-muted-foreground">Esta janela fechará automaticamente...</p>}
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">{status}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GitHubCallback;
