import { useAuth } from "@/contexts/AuthContext";
import { Code2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  repoName?: string;
  onBack?: () => void;
}

export default function AppHeader({ repoName, onBack }: AppHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
      <button onClick={onBack} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <Code2 className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm text-foreground">Git Editor</span>
      </button>

      {repoName && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-foreground font-medium">{repoName}</span>
        </>
      )}

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src={user.avatar_url} className="h-6 w-6 rounded-full" alt={user.login} />
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.login}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      )}
    </header>
  );
}
