import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Code2, LogOut, Wallet, Shield, Languages, Brain, Cpu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  repoName?: string;
  onBack?: () => void;
  onWallet?: () => void;
  onAdmin?: () => void;
}

export default function AppHeader({ repoName, onBack, onWallet, onAdmin }: AppHeaderProps) {
  const { user, isAdmin, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
      <button onClick={onBack} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <Code2 className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm text-foreground">IAProgramador</span>
      </button>

      {repoName && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-foreground font-medium">{repoName}</span>
        </>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("language")}>
              <Languages className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage("pt-BR")} className={language === "pt-BR" ? "bg-accent" : ""}>
              Português (Brasil)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("en-US")} className={language === "en-US" ? "bg-accent" : ""}>
              English (US)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("es-ES")} className={language === "es-ES" ? "bg-accent" : ""}>
              Español (ES)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {user && (
          <>
            <Button variant="ghost" size="icon" onClick={() => navigate("/obsidian")} className="h-8 w-8" title="Cérebro Obsidian">
              <Brain className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/autonomous")} className="h-8 w-8" title="Autonomous AI">
              <Cpu className="h-4 w-4 text-primary" />
            </Button>
            {isAdmin && onAdmin && (
              <Button variant="ghost" size="icon" onClick={onAdmin} className="h-8 w-8" title={t("admin")}>
                <Shield className="h-4 w-4" />
              </Button>
            )}
            {onWallet && (
              <Button variant="ghost" size="icon" onClick={onWallet} className="h-8 w-8" title={t("wallet")}>
                <Wallet className="h-4 w-4" />
              </Button>
            )}
            <NotificationBell />
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8" title={t("logout")}>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
