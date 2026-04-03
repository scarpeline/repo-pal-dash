import { useState } from "react";
import { type GitHubRepo } from "@/lib/github";
import AppHeader from "@/components/AppHeader";
import RepoList from "@/components/RepoList";
import RepoEditor from "@/components/RepoEditor";

export default function Dashboard() {
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

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
      <AppHeader />
      <div className="flex-1 max-w-3xl w-full mx-auto p-6">
        <h2 className="text-xl font-bold text-foreground mb-6">Seus Repositórios</h2>
        <RepoList onSelectRepo={setSelectedRepo} />
      </div>
    </div>
  );
}
