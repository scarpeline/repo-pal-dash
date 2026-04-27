import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Processando login...");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(`Erro: ${errorParam}`);
      setTimeout(() => navigate("/", { replace: true }), 2000);
      return;
    }

    if (!code) {
      setError("Código de autorização não encontrado");
      setTimeout(() => navigate("/", { replace: true }), 2000);
      return;
    }

    async function exchangeAndLogin() {
      try {
        setStatus("Obtendo dados do Google...");

        const tokenRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/google-oauth`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              redirect_uri: `${window.location.origin}/google/callback`,
            }),
          }
        );

        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({ error: "Erro desconhecido" }));
          throw new Error(err.error || `Erro ${tokenRes.status}`);
        }

        const { user: googleUser } = await tokenRes.json();

        if (!googleUser?.email) {
          throw new Error("Email não retornado pelo Google");
        }

        setStatus("Autenticando...");

        // Senha determinística baseada no ID do Google
        const password = `Goog_${googleUser.id}_oauth`;

        // Tentar login primeiro
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: googleUser.email,
          password,
        });

        if (!signInError && signInData.session) {
          // Login bem sucedido — atualizar perfil
          await supabase.from("profiles").upsert({
            id: signInData.user.id,
            email: googleUser.email,
            full_name: googleUser.name,
            avatar_url: googleUser.picture,
            updated_at: new Date().toISOString(),
          });

          setStatus("Login realizado!");
          setSuccess(true);
          toast.success(`Bem-vindo, ${googleUser.name}!`);
          setTimeout(() => navigate("/", { replace: true }), 1000);
          return;
        }

        // Login falhou — criar conta nova
        setStatus("Criando conta...");

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: googleUser.email,
          password,
          options: {
            data: {
              full_name: googleUser.name,
              avatar_url: googleUser.picture,
              provider: "google",
            },
          },
        });

        if (signUpError) {
          // Usuário já existe mas senha diferente — tentar com senha antiga
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
            email: googleUser.email,
            password: `google_oauth_${googleUser.id}`,
          });

          if (!retryError && retryData.session) {
            // Atualizar senha para o novo padrão
            await supabase.auth.updateUser({ password });
            await supabase.from("profiles").upsert({
              id: retryData.user.id,
              email: googleUser.email,
              full_name: googleUser.name,
              avatar_url: googleUser.picture,
              updated_at: new Date().toISOString(),
            });
            setStatus("Login realizado!");
            setSuccess(true);
            toast.success(`Bem-vindo, ${googleUser.name}!`);
            setTimeout(() => navigate("/", { replace: true }), 1000);
            return;
          }

          throw new Error("Não foi possível autenticar. Tente criar conta manualmente.");
        }

        if (signUpData.session) {
          // Cadastro com sessão imediata (email confirm desativado)
          await supabase.from("profiles").upsert({
            id: signUpData.user!.id,
            email: googleUser.email,
            full_name: googleUser.name,
            avatar_url: googleUser.picture,
            updated_at: new Date().toISOString(),
          });
          setStatus("Conta criada!");
          setSuccess(true);
          toast.success(`Bem-vindo, ${googleUser.name}!`);
          setTimeout(() => navigate("/", { replace: true }), 1000);
        } else {
          // Email confirm ativado — avisar usuário
          setError("Confirme seu email para ativar a conta, depois faça login normalmente.");
          toast.info("Verifique seu email para confirmar a conta.");
          setTimeout(() => navigate("/", { replace: true }), 4000);
        }
      } catch (err: any) {
        console.error("Google callback error:", err);
        const msg = err.message || "Erro ao processar login com Google";
        setError(msg);
        toast.error(msg);
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
    }

    exchangeAndLogin();
  }, [searchParams, navigate]);

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
