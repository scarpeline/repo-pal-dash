import { Github, LogOut, Link2, Loader2, CheckCircle, Zap, Edit3, ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { exchangeCodeForToken, setToken, validateToken } from "@/lib/github";
import { toast } from "sonner";

interface GitHubConnectProps {
  isConnected: boolean;
  user: { login: string; avatar_url: string; name: string } | null;
  onDisconnect: () => void;
  onCloneUrl?: (url: string) => void;
  onConnected?: (token: string, user: { login: string; avatar_url: string; name: string }) => void;
}

const GitHubConnect = ({ isConnected, user, onDisconnect, onCloneUrl, onConnected }: GitHubConnectProps) => {
  const [cloneUrl, setCloneUrl] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Escutar mensagens do popup via BroadcastChannel
  useEffect(() => {
    if (!connecting || !("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel("github-oauth");
    channel.onmessage = (event) => {
      if (event.data?.type === "github-connected") {
        setConnecting(false);
        if (onConnected && event.data.token && event.data.user) {
          onConnected(event.data.token, event.data.user);
        }
        channel.close();
      }
    };

    return () => channel.close();
  }, [connecting, onConnected]);

  const handleOAuth = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/github/callback`;
      const state = Math.random().toString(36).substring(7);
      localStorage.setItem("gh_oauth_state", state);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/github-oauth?action=get_client_id`);
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Falha ao obter configuração OAuth");
      }
      const { client_id: clientId } = await res.json();
      if (!clientId) throw new Error("GitHub OAuth não configurado no servidor");

      const width = 600, height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      const popup = window.open(
        `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${state}`,
        "github-oauth",
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      if (!popup) {
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${state}`;
        return;
      }

      const interval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(interval);
            setConnecting(false);
            const token = localStorage.getItem("gh_token");
            const storedUser = localStorage.getItem("gh_user");
            if (token && storedUser && onConnected) {
              try {
                onConnected(token, JSON.parse(storedUser));
              } catch {}
            }
          }
        } catch {
          // Cross-origin, keep waiting
        }
      }, 500);
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar com GitHub");
      setConnecting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-5 space-y-5">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto">
            <Github className="w-8 h-8 text-foreground" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Conectar ao GitHub</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Acesse repositórios, edite e faça commits direto do IAProgramador.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-[hsl(var(--success))] shrink-0" />
            <span>Login seguro via OAuth</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Zap className="w-4 h-4 text-[hsl(var(--warning))] shrink-0" />
            <span>Sem tokens manuais</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Edit3 className="w-4 h-4 text-primary shrink-0" />
            <span>Edite e faça commit sem sair</span>
          </div>
        </div>

        <Button onClick={handleOAuth} className="w-full gap-2" size="default" disabled={connecting}>
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
          Entrar com GitHub →
        </Button>

        <div className="flex items-start gap-2 text-[10px] text-muted-foreground/60 leading-tight">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Você será redirecionado ao GitHub para autorizar o acesso. Certifique-se de permitir pop-ups.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {user?.avatar_url && <img src={user.avatar_url} className="w-6 h-6 rounded-full" alt="" />}
          <span className="text-xs font-medium text-foreground">@{user?.login}</span>
        </div>
        <button onClick={onDisconnect} className="text-muted-foreground hover:text-destructive">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
      {onCloneUrl && (
        <div className="flex gap-1">
          <Input
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            className="text-xs h-7"
          />
          <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => { if (cloneUrl) { onCloneUrl(cloneUrl); setCloneUrl(""); } }}>
            <Link2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default GitHubConnect;
