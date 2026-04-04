import { useState, useRef, useEffect } from "react";
import { TerminalSquare } from "lucide-react";

interface TerminalMessage {
  type: "input" | "output" | "error" | "system" | "success";
  text: string;
  timestamp: Date;
}

interface TerminalPanelProps {
  messages: TerminalMessage[];
  onCommand: (cmd: string) => void;
}

const TerminalPanel = ({ messages, onCommand }: TerminalPanelProps) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    setHistory((prev) => [input, ...prev]);
    setHistoryIndex(-1);
    onCommand(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIdx = historyIndex + 1;
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };

  const getColor = (type: TerminalMessage["type"]) => {
    switch (type) {
      case "input": return "text-secondary";
      case "output": return "text-foreground";
      case "error": return "text-destructive";
      case "system": return "text-muted-foreground";
      case "success": return "text-terminal-green";
    }
  };

  return (
    <div className="flex flex-col h-full bg-terminal font-mono text-xs">
      {/* Terminal output */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-0.5">
        {messages.map((msg, i) => (
          <div key={i} className={`${getColor(msg.type)} animate-slide-in`}>
            {msg.type === "input" ? (
              <span><span className="text-terminal-green">❯</span> {msg.text}</span>
            ) : (
              <span>{msg.text}</span>
            )}
          </div>
        ))}
      </div>

      {/* Input line */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <span className="text-terminal-green">❯</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite um comando..."
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
};

export default TerminalPanel;
