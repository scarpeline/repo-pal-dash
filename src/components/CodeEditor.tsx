import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getFileContent, getFileSha, updateFile } from "@/lib/github";
import { useState, useEffect } from "react";
import { Save, X, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CodeEditorProps {
  owner: string;
  repo: string;
  filePath: string;
  branch: string;
  onClose: () => void;
}

export default function CodeEditor({ owner, repo, filePath, branch, onClose }: CodeEditorProps) {
  const { ghToken: token } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const { data: fileData, isLoading } = useQuery({
    queryKey: ["file", owner, repo, filePath, branch],
    queryFn: () => getFileContent(token!, owner, repo, filePath, branch),
    enabled: !!token,
  });

  useEffect(() => {
    if (fileData !== undefined) {
      setContent(fileData.content);
      setIsDirty(false);
    }
  }, [fileData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sha = await getFileSha(token!, owner, repo, filePath, branch);
      await updateFile(token!, owner, repo, filePath, content, `Update ${filePath}`, sha, branch);
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["file", owner, repo, filePath] });
      queryClient.invalidateQueries({ queryKey: ["commits", owner, repo] });
      toast.success("Arquivo salvo com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  const fileName = filePath.split("/").pop() || filePath;
  const lines = content.split("\n");

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-editor-bg">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-editor-bg">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-primary bg-editor-bg">
          <FileCode className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm text-foreground">{fileName}</span>
          {isDirty && <span className="h-2 w-2 rounded-full bg-warning" />}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="gap-1 text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="flex min-h-full">
          {/* Line numbers */}
          <div className="sticky left-0 bg-editor-bg border-r border-border px-3 py-3 text-right select-none">
            {lines.map((_, i) => (
              <div key={i} className="text-xs leading-6 line-number">
                {i + 1}
              </div>
            ))}
          </div>
          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(true);
            }}
            className="flex-1 bg-transparent text-foreground text-sm leading-6 p-3 resize-none outline-none font-mono"
            spellCheck={false}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (isDirty) saveMutation.mutate();
              }
              if (e.key === "Tab") {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const newContent = content.substring(0, start) + "  " + content.substring(end);
                setContent(newContent);
                setIsDirty(true);
                requestAnimationFrame(() => {
                  e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
