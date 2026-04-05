import { useState } from "react";
import { type GitHubRepo } from "@/lib/github";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import RepoList from "@/components/RepoList";
import RepoEditor from "@/components/RepoEditor";
import WalletPage from "@/pages/WalletPage";
import AdminPage from "@/pages/AdminPage";
import AffiliateSection from "@/components/AffiliateSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Gift, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = "repos" | "wallet" | "admin";

export default function Dashboard() {
  const { ghToken, user } = useAuth();
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [view, setView] = useState<View>("repos");

  if (view === "wallet") {
    return <WalletPage onBack={() => setView("repos")} />;
  }

  if (view === "admin") {
    return <AdminPage onBack={() => setView("repos")} />;
  }

  if (selectedRepo) {
    return (
      <RepoEditor
        repo={selectedRepo}
        onBack={() => setSelectedRepo(null)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader
        onWallet={() => setView("wallet")}
        onAdmin={() => setView("admin")}
      />
      <div className="flex-1 max-w-3xl w-full mx-auto p-6">
        <Tabs defaultValue="repos">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="repos" className="gap-2">
              <Code2 className="h-4 w-4" /> Repositórios
            </TabsTrigger>
            <TabsTrigger value="affiliate" className="gap-2">
              <Gift className="h-4 w-4" /> Indique e Ganhe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="repos">
            {ghToken ? (
              <>
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <h2 className="text-xl font-bold text-foreground mb-2">
                    👋 Bem-vindo(a), {user?.user_metadata?.full_name || user?.email || 'Desenvolvedor'}!
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ready to code? Seus repositórios estão prontos para edição. 🚀
                  </p>
                  
                  {/* Acesso Total ao IAProgramador */}
                  <div className="bg-white/80 rounded-lg p-3 border border-blue-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Acesso Total ao IAProgramador
                        </h3>
                        <p className="text-xs text-blue-600 mt-1">
                          Visualize o app publicado e explore o repositório completo
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open("/repo-access?owner=scarpeline&repo=repo-pal-dash&live=true", "_blank")}
                          className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Acessar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-foreground mb-6">Seus Repositórios</h2>
                <RepoList onSelectRepo={setSelectedRepo} />
              </>
            ) : (
              <div className="text-center py-12 space-y-4">
                <h2 className="text-xl font-bold text-foreground">Bem-vindo ao CodPilot!</h2>
                <p className="text-muted-foreground">
                  Recarregue sua carteira para usar o editor de código com IA.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="affiliate">
            <AffiliateSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
