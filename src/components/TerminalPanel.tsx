import { useState, useRef, useEffect } from "react";

type TermMsg = { type: "input" | "output" | "error" | "system" | "success"; text: string; timestamp: Date };

interface TerminalPanelProps {
  messages: TermMsg[];
  onCommand: (cmd: string) => void;
}

const TerminalPanel = ({ messages, onCommand }: TerminalPanelProps) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onCommand(input.trim());
    setInput("");
  };

  const colorMap: Record<string, string> = {
    input: "text-foreground",
    output: "text-muted-foreground",
    error: "text-destructive",
    system: "text-[hsl(var(--info))]",
    success: "text-[hsl(var(--success))]",
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--editor-bg))]">
      <div className="flex-1 overflow-auto p-3 space-y-0.5 font-mono text-xs">
        {messages.map((m, i) => (
          <div key={i} className={colorMap[m.type] || "text-foreground"}>
            {m.type === "input" ? `$ ${m.text}` : m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-border flex items-center px-3 py-2">
        <span className="text-[hsl(var(--success))] text-xs font-mono mr-2">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent text-foreground text-xs font-mono outline-none"
          placeholder="Digite um comando..."
        />
      </form>
    </div>
  );
};

export default TerminalPanel;
