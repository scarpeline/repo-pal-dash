import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getBranches, createBranch, type GitHubBranch } from "@/lib/github";
import { GitBranch, Plus, Check, Shield } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BranchSelectorProps {
  owner: string;
  repo: string;
  currentBranch: string;
  onBranchChange: (branch: string) => void;
}

export default function BranchSelector({ owner, repo, currentBranch, onBranchChange }: BranchSelectorProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ["branches", owner, repo],
    queryFn: () => getBranches(token!, owner, repo),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const current = branches?.find((b) => b.name === currentBranch);
      if (!current) throw new Error("Branch atual não encontrada");
      await createBranch(token!, owner, repo, newBranchName, current.commit.sha);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches", owner, repo] });
      onBranchChange(newBranchName);
      setNewBranchName("");
      setShowCreate(false);
      setOpen(false);
      toast.success(`Branch "${newBranchName}" criada!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-sm">
          <GitBranch className="h-3.5 w-3.5" />
          {currentBranch}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-popover border-border" align="start">
        <div className="p-2 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Branches</p>
        </div>
        <div className="max-h-60 overflow-y-auto scrollbar-thin p-1">
          {branches?.map((b) => (
            <button
              key={b.name}
              onClick={() => { onBranchChange(b.name); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors",
                b.name === currentBranch && "bg-primary/10 text-primary"
              )}
            >
              {b.name === currentBranch ? <Check className="h-3.5 w-3.5" /> : <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="truncate">{b.name}</span>
              {b.protected && <Shield className="h-3 w-3 text-warning ml-auto" />}
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-border">
          {showCreate ? (
            <div className="flex gap-1">
              <Input
                placeholder="Nome da branch"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="h-8 text-sm bg-card"
                onKeyDown={(e) => e.key === "Enter" && newBranchName && createMutation.mutate()}
              />
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newBranchName || createMutation.isPending} className="h-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="w-full gap-2 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> Nova branch
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
