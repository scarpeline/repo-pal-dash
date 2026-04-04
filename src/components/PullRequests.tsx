import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getPullRequests, createPullRequest, getBranches } from "@/lib/github";
import { GitPullRequest, Plus, ExternalLink, GitMerge, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PullRequestsProps {
  owner: string;
  repo: string;
}

export default function PullRequests({ owner, repo }: PullRequestsProps) {
  const { ghToken: token } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [head, setHead] = useState("");
  const [base, setBase] = useState("");

  const { data: prs, isLoading } = useQuery({
    queryKey: ["prs", owner, repo],
    queryFn: () => getPullRequests(token!, owner, repo, "all"),
    enabled: !!token,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", owner, repo],
    queryFn: () => getBranches(token!, owner, repo),
    enabled: !!token && showCreate,
  });

  const createMutation = useMutation({
    mutationFn: () => createPullRequest(token!, owner, repo, title, head, base, body || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prs", owner, repo] });
      setShowCreate(false);
      setTitle(""); setBody(""); setHead(""); setBase("");
      toast.success("Pull Request criado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-medium text-foreground">Pull Requests</h3>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3.5 w-3.5" /> Novo PR
        </Button>
      </div>

      {showCreate && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-3">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-muted" />
          <Textarea placeholder="Descrição (opcional)" value={body} onChange={(e) => setBody(e.target.value)} className="bg-muted min-h-[80px]" />
          <div className="grid grid-cols-2 gap-2">
            <Select onValueChange={setHead}>
              <SelectTrigger className="bg-muted"><SelectValue placeholder="De (head)" /></SelectTrigger>
              <SelectContent>{branches?.map((b) => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={setBase}>
              <SelectTrigger className="bg-muted"><SelectValue placeholder="Para (base)" /></SelectTrigger>
              <SelectContent>{branches?.map((b) => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!title || !head || !base || createMutation.isPending} className="w-full">
            {createMutation.isPending ? "Criando..." : "Criar Pull Request"}
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {prs?.map((pr) => (
          <a
            key={pr.id}
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors group"
          >
            {pr.merged_at ? (
              <GitMerge className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            ) : pr.state === "open" ? (
              <CircleDot className="h-5 w-5 text-success shrink-0 mt-0.5" />
            ) : (
              <GitPullRequest className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {pr.title}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>#{pr.number}</span>
                <span>{pr.user.login}</span>
                <span>
                  {formatDistanceToNow(new Date(pr.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  pr.merged_at ? "bg-accent/20 text-accent" : pr.state === "open" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                )}>
                  {pr.merged_at ? "merged" : pr.state}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {pr.head.ref} → {pr.base.ref}
              </div>
            </div>
          </a>
        ))}
        {prs?.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum Pull Request encontrado.</p>
        )}
      </div>
    </div>
  );
}
