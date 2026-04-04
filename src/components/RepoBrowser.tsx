import { useEffect, useState } from "react";
import { getRepos, type GHRepo } from "@/lib/github";
import { Loader2, Star, GitFork, Lock, Globe } from "lucide-react";
import { getLanguageColor } from "@/lib/github";

interface RepoBrowserProps {
  token: string;
  onSelectRepo: (repo: GHRepo) => void;
  onBack: () => void;
}

const RepoBrowser = ({ token, onSelectRepo, onBack }: RepoBrowserProps) => {
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getRepos(token).then((r) => { setRepos(r); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar repositório..."
          className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((repo) => (
          <button
            key={repo.id}
            onClick={() => onSelectRepo(repo)}
            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border transition-colors"
          >
            <div className="flex items-center gap-2">
              {repo.private ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Globe className="w-3 h-3 text-muted-foreground" />}
              <span className="text-xs font-medium text-foreground truncate">{repo.name}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {repo.language && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: getLanguageColor(repo.language) }} />
                  {repo.language}
                </span>
              )}
              <span className="flex items-center gap-0.5"><Star className="w-3 h-3" />{repo.stargazers_count}</span>
              <span className="flex items-center gap-0.5"><GitFork className="w-3 h-3" />{repo.forks_count}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RepoBrowser;
