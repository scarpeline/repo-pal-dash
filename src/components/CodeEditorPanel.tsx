import { useState } from "react";
import { FileCode } from "lucide-react";

interface CodeEditorPanelProps {
  content: string;
  fileName: string;
  onChange: (content: string) => void;
}

const CodeEditorPanel = ({ content, fileName, onChange }: CodeEditorPanelProps) => {
  const lines = content.split("\n");

  return (
    <div className="flex h-full bg-[hsl(var(--editor-bg))]">
      {/* Line numbers */}
      <div className="sticky left-0 bg-[hsl(var(--editor-bg))] border-r border-border px-3 py-3 text-right select-none shrink-0">
        {lines.map((_, i) => (
          <div key={i} className="text-xs leading-6 line-number">{i + 1}</div>
        ))}
      </div>
      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-foreground text-sm leading-6 p-3 resize-none outline-none font-mono"
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const newContent = content.substring(0, start) + "  " + content.substring(end);
            onChange(newContent);
            requestAnimationFrame(() => {
              e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
            });
          }
        }}
      />
    </div>
  );
};

export default CodeEditorPanel;
