import { Github, LogOut, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface GitHubConnectProps {
  isConnected: boolean;
  user: { login: string; avatar_url: string; name: string } | null;
  onDisconnect: () => void;
  onCloneUrl?: (url: string) => void;
}

const GitHubConnect = ({ isConnected, user, onDisconnect, onCloneUrl }: GitHubConnectProps) => {
  const [cloneUrl, setCloneUrl] = useState("");

  const handleOAuth = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/github/callback`;
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem("gh_oauth_state", state);
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${state}`;
  };

  if (!isConnected) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center space-y-2">
          <Github className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">Conecte seu GitHub para editar repositórios</p>
        </div>
        <Button onClick={handleOAuth} className="w-full gap-2" size="sm">
          <Github className="w-4 h-4" /> Conectar GitHub
        </Button>
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
