import { useState } from "react";
import { type GitHubRepo } from "@/lib/github";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import RepoList from "@/components/RepoList";
import RepoEditor from "@/components/RepoEditor";
import WalletPage from "@/pages/WalletPage";
import AdminPage from "@/pages/AdminPage";

type View = "repos" | "wallet" | "admin";

export default function Dashboard() {
  const { ghToken } = useAuth();
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
        {ghToken ? (
          <>
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
      </div>
    </div>
  );
}
