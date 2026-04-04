import { useState } from "react";
import { updateFile } from "@/lib/github";
import { Save, Loader2 } from "lucide-react";

interface CommitBarProps {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  fileSha?: string;
  onCommitSuccess: (newSha: string, commitUrl: string) => void;
}

const CommitBar = ({ token, owner, repo, branch, filePath, content, fileSha, onCommitSuccess }: CommitBarProps) => {
  const [message, setMessage] = useState(`Update ${filePath.split("/").pop()}`);
  const [saving, setSaving] = useState(false);

  const handleCommit = async () => {
    if (!fileSha) return;
    setSaving(true);
    try {
      const result = await updateFile(token, owner, repo, filePath, content, message, fileSha, branch);
      onCommitSuccess(result.sha, result.commitUrl);
    } catch (err: any) {
      console.error("Commit error:", err);
    }
    setSaving(false);
  };

  return (
    <div className="h-10 border-t border-border bg-card flex items-center px-3 gap-2 shrink-0">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
        placeholder="Mensagem do commit..."
      />
      <button
        onClick={handleCommit}
        disabled={saving || !message.trim()}
        className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Commit
      </button>
    </div>
  );
};

export default CommitBar;
