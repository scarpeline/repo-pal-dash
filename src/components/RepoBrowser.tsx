import { useEffect, useState } from "react";
import { getRepos, type GHRepo } from "@/lib/github";
import { Loader2, Star, GitFork, Lock, Globe, ChevronDown, ChevronUp } from "lucide-react";
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    getRepos(token).then((r) => { setRepos(r); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b border-border flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          {!isCollapsed && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar repositório..."
              className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-primary animate-in fade-in duration-200"
            />
          )}
          {isCollapsed && <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Repositórios</span>}
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground"
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="flex-1 overflow-auto animate-in fade-in slide-in-from-top-1 duration-200">
          {filtered.length > 0 ? filtered.map((repo) => (
            <button
              key={repo.id}
              onClick={() => onSelectRepo(repo)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border transition-colors group"
            >
              <div className="flex items-center gap-2">
                {repo.private ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Globe className="w-3 h-3 text-muted-foreground" />}
                <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{repo.name}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                {repo.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: getLanguageColor(repo.language) }} />
                    {repo.language}
                  </span>
                )}
                <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />{repo.stargazers_count}</span>
                <span className="flex items-center gap-0.5"><GitFork className="w-2.5 h-2.5" />{repo.forks_count}</span>
              </div>
            </button>
          )) : (
            <div className="p-4 text-center text-xs text-muted-foreground">Nenhum repositório encontrado</div>
          )}
        </div>
      )}
    </div>
  );
};

export default RepoBrowser;
