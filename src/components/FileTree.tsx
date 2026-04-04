import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getContents, type GitHubContent } from "@/lib/github";
import { File, Folder, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  owner: string;
  repo: string;
  branch: string;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const colorMap: Record<string, string> = {
    ts: "text-info", tsx: "text-info",
    js: "text-warning", jsx: "text-warning",
    json: "text-warning",
    css: "text-accent", scss: "text-accent",
    html: "text-destructive",
    md: "text-foreground",
    py: "text-info",
    rs: "text-destructive",
    go: "text-info",
  };
  return <File className={cn("h-4 w-4 shrink-0", colorMap[ext] || "text-muted-foreground")} />;
}

function TreeNode({
  item, owner, repo, branch, depth, onSelectFile, selectedFile,
}: {
  item: GitHubContent; owner: string; repo: string; branch: string;
  depth: number; onSelectFile: (path: string) => void; selectedFile?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { ghToken: token } = useAuth();

  const { data: children } = useQuery({
    queryKey: ["contents", owner, repo, item.path, branch],
    queryFn: () => getContents(token!, owner, repo, item.path, branch),
    enabled: item.type === "dir" && expanded && !!token,
  });

  const isDir = item.type === "dir";
  const isSelected = selectedFile === item.path;

  const sorted = children?.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onSelectFile(item.path);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 py-1 px-2 text-sm hover:bg-muted/50 rounded transition-colors",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          <>
            {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {expanded ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0 text-primary" />}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <FileIcon name={item.name} />
          </>
        )}
        <span className="truncate">{item.name}</span>
      </button>
      {isDir && expanded && sorted?.map((child) => (
        <TreeNode
          key={child.path}
          item={child}
          owner={owner}
          repo={repo}
          branch={branch}
          depth={depth + 1}
          onSelectFile={onSelectFile}
          selectedFile={selectedFile}
        />
      ))}
    </div>
  );
}

export default function FileTree({ owner, repo, branch, onSelectFile, selectedFile }: FileTreeProps) {
  const { ghToken: token } = useAuth();

  const { data: contents, isLoading } = useQuery({
    queryKey: ["contents", owner, repo, "", branch],
    queryFn: () => getContents(token!, owner, repo, "", branch),
    enabled: !!token,
  });

  const sorted = contents?.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="py-1 scrollbar-thin overflow-y-auto">
      {sorted?.map((item) => (
        <TreeNode
          key={item.path}
          item={item}
          owner={owner}
          repo={repo}
          branch={branch}
          depth={0}
          onSelectFile={onSelectFile}
          selectedFile={selectedFile}
        />
      ))}
    </div>
  );
}
