import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import logoImg from "@/assets/logo-iaprogramador.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const refCode = searchParams.get("ref");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado!");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, ref_code: refCode || undefined },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        
        // Verificar se precisa de confirmação de email
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          toast.success("Conta criada! Verifique seu email para confirmar o cadastro.");
        } else if (data?.session) {
          // Login automático se não precisar de confirmação
          toast.success("Conta criada com sucesso! Bem-vindo!");
        } else {
          toast.success("Conta criada! Verifique seu email para ativar.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na autenticação");
    }
    setLoading(false);
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // Verificar se Google OAuth está configurado
      const configRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-oauth?action=get_client_id`
      );

      if (!configRes.ok) {
        const errorData = await configRes.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errorData.error || "Google OAuth não configurado");
      }

      const { client_id: clientId } = await configRes.json();

      if (!clientId) {
        throw new Error("Google OAuth não configurado. Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Lovable Secrets.");
      }

      // Gerar state para segurança
      const state = Math.random().toString(36).substring(7);
      localStorage.setItem("google_oauth_state", state);

      // Redirecionar para Google OAuth
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${window.location.origin}/google/callback`,
        response_type: "code",
        scope: "openid email profile",
        state: state,
        access_type: "online",
        prompt: "consent",
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar com Google");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <img src={logoImg} alt="IAProgramador" className="w-24 h-24 object-contain" />
          </div>
          <CardTitle>{isLogin ? "Entrar" : "Criar conta"}</CardTitle>
          <CardDescription>
            {isLogin ? "Acesse sua conta IAProgramador" : "Crie sua conta e comece a programar com IA"}
          </CardDescription>
          {refCode && !isLogin && (
            <p className="text-xs text-primary mt-1">🎁 Indicado por: {refCode}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Entrar com Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            )}
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline">
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
