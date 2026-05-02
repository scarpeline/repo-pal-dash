import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
        toast.success("Acesso autorizado!");
        navigate("/", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado!");
        setTimeout(() => navigate("/", { replace: true }), 500);
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

        if (data?.session) {
          // Confirmação desativada — sessão imediata
          toast.success("Conta criada! Bem-vindo!");
          setTimeout(() => navigate("/", { replace: true }), 500);
        } else if (data?.user && data.user.identities?.length === 0) {
          // Usuário já existe — tentar login direto
          const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
          if (loginError) throw new Error("Email já cadastrado. Verifique sua senha.");
          toast.success("Login realizado!");
          setTimeout(() => navigate("/", { replace: true }), 500);
        } else {
          // Confirmação ativada — tentar login mesmo assim
          const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
          if (loginData?.session) {
            toast.success("Conta criada! Bem-vindo!");
            setTimeout(() => navigate("/", { replace: true }), 500);
          } else {
            toast.info("Conta criada! Verifique seu email para ativar, depois faça login.");
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na autenticação");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/`,
      });

      if (result.error) {
        throw result.error instanceof Error ? result.error : new Error(String(result.error));
      }

      if (result.redirected) {
        // Browser will redirect to Google
        return;
      }

      // Tokens received and session set
      toast.success("Acesso autorizado com Google!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar com Google");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden font-sans selection:bg-primary/30">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center relative z-10 p-6">
        
        {/* Left Section: Copy & Branding */}
        <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
              <img src={logoImg} alt="IAProgramador" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
                IAProgramador
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30 font-bold uppercase tracking-tighter">v2.0</span>
              </h1>
              <p className="text-sm text-blue-400 font-semibold tracking-wide">A Próxima Geração do Desenvolvimento Autônomo</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-5xl lg:text-6xl font-black leading-[1.1] text-white tracking-tight">
              Seu Novo <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Colega de Equipe</span> é uma IA.
            </h2>
            
            <p className="text-xl text-slate-400 leading-relaxed max-w-lg">
              Conecte seu GitHub e veja a IA navegar, editar e commitar código real. 
              <span className="text-white font-medium"> Sem complicações. Apenas resultados.</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-primary/30 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="text-primary font-bold">✓</span>
              </div>
              <h3 className="font-bold text-white mb-1">Agente Autônomo</h3>
              <p className="text-xs text-slate-500 leading-tight">Ela lê seu repositório inteiro e entende o contexto real do seu projeto.</p>
            </div>

            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-blue-400/30 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="text-blue-400 font-bold">⚡</span>
              </div>
              <h3 className="font-bold text-white mb-1">Multi-Modelos</h3>
              <p className="text-xs text-slate-500 leading-tight">Claude 3.5 Sonnet, Gemini 1.5 Pro e GPT-4o trabalhando juntos para você.</p>
            </div>

            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-emerald-400/30 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="text-emerald-400 font-bold">🚀</span>
              </div>
              <h3 className="font-bold text-white mb-1">Live Preview</h3>
              <p className="text-xs text-slate-500 leading-tight">Veja as alterações acontecerem ao vivo em um preview integrado e responsivo.</p>
            </div>

            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-amber-400/30 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="text-amber-400 font-bold">💰</span>
              </div>
              <h3 className="font-bold text-white mb-1">Pay-as-you-go</h3>
              <p className="text-xs text-slate-500 leading-tight">Sem assinaturas presas. Pague apenas pelo que usar com créditos via PIX.</p>
            </div>
          </div>
        </div>

        {/* Right Section: Auth Card */}
        <div className="animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
          <Card className="w-full bg-slate-900/50 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center mb-4 lg:hidden">
                <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                  <img src={logoImg} alt="IAProgramador" className="w-12 h-12 object-contain" />
                </div>
              </div>
              <CardTitle className="text-2xl font-black text-white">{isLogin ? "Bem-vindo de volta" : "Comece sua jornada"}</CardTitle>
              <CardDescription className="text-slate-400">
                {isLogin ? "Acesse sua workstation com IA" : "Crie sua conta e comece a programar em minutos"}
              </CardDescription>
              {refCode && !isLogin && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] text-primary font-bold uppercase tracking-wider mx-auto">
                  🎁 Convite Especial: {refCode}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <Button
                variant="outline"
                className="w-full h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white gap-3 rounded-xl transition-all"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span className="font-semibold text-sm">Entrar com Google</span>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-slate-600"><span className="bg-[#0f172a] px-3">ou via email</span></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 ml-1 uppercase">Nome Completo</label>
                    <Input 
                      placeholder="Como quer ser chamado?" 
                      className="bg-white/5 border-white/10 focus:border-primary/50 text-white h-11 rounded-xl"
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                      required 
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 ml-1 uppercase">Endereço de Email</label>
                  <Input 
                    type="email" 
                    placeholder="seu@email.com" 
                    className="bg-white/5 border-white/10 focus:border-primary/50 text-white h-11 rounded-xl"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 ml-1 uppercase">Sua Senha</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="bg-white/5 border-white/10 focus:border-primary/50 text-white h-11 rounded-xl"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    minLength={6} 
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-[0.98]" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {isLogin ? "Acessar Plataforma" : "Criar Minha Conta"}
                </Button>
              </form>

              <div className="text-center pt-2">
                <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 mx-auto group">
                  {isLogin ? "Não tem conta?" : "Já possui conta?"}
                  <span className="text-primary font-bold group-hover:underline">{isLogin ? "Cadastre-se agora" : "Entrar aqui"}</span>
                </button>
              </div>
            </CardContent>
          </Card>
          
          <p className="text-center text-[11px] text-slate-500 mt-6">
            Ao continuar, você concorda com nossos <span className="underline hover:text-slate-300 cursor-pointer">Termos de Uso</span> e <span className="underline hover:text-slate-300 cursor-pointer">Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
