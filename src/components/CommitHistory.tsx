import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getCommits } from "@/lib/github";
import { GitCommit, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CommitHistoryProps {
  owner: string;
  repo: string;
  branch: string;
}

export default function CommitHistory({ owner, repo, branch }: CommitHistoryProps) {
  const { token } = useAuth();

  const { data: commits, isLoading } = useQuery({
    queryKey: ["commits", owner, repo, branch],
    queryFn: () => getCommits(token!, owner, repo, branch),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {commits?.map((commit, i) => (
        <div key={commit.sha} className="flex gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {commit.author?.avatar_url ? (
                <img src={commit.author.avatar_url} className="h-8 w-8 rounded-full" alt="" />
              ) : (
                <GitCommit className="h-4 w-4 text-primary" />
              )}
            </div>
            {i < (commits?.length || 0) - 1 && (
              <div className="w-px flex-1 bg-border mt-1" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground line-clamp-2 font-medium">
              {commit.commit.message}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{commit.author?.login || commit.commit.author.name}</span>
              <Clock className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(commit.commit.author.date), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                {commit.sha.slice(0, 7)}
              </code>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
