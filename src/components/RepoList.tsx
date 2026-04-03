import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getRepos, getLanguageColor, type GitHubRepo } from "@/lib/github";
import { Star, GitFork, Lock, Globe, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface RepoListProps {
  onSelectRepo: (repo: GitHubRepo) => void;
}

export default function RepoList({ onSelectRepo }: RepoListProps) {
  const { token } = useAuth();
  const [search, setSearch] = useState("");

  const { data: repos, isLoading } = useQuery({
    queryKey: ["repos"],
    queryFn: () => getRepos(token!),
    enabled: !!token,
  });

  const filtered = repos?.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar repositórios..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <div className="space-y-2">
        {filtered?.map((repo) => (
          <button
            key={repo.id}
            onClick={() => onSelectRepo(repo)}
            className="w-full text-left p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              {repo.private ? (
                <Lock className="h-3.5 w-3.5 text-warning" />
              ) : (
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                {repo.name}
              </span>
            </div>
            {repo.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {repo.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {repo.language && (
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getLanguageColor(repo.language) }}
                  />
                  {repo.language}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" /> {repo.stargazers_count}
              </span>
              <span className="flex items-center gap-1">
                <GitFork className="h-3 w-3" /> {repo.forks_count}
              </span>
            </div>
          </button>
        ))}
        {filtered?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum repositório encontrado.</p>
        )}
      </div>
    </div>
  );
}
