import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

type ChatMsg = { role: "user" | "ai" | "system"; content: string; timestamp: Date };

interface AIChatProps {
  messages: ChatMsg[];
  onSend: (message: string, provider?: string) => void;
  isThinking: boolean;
}

const AIChat = ({ messages, onSend, isThinking }: AIChatProps) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--editor-bg))]">
      <div className="flex-1 overflow-auto p-3 space-y-3 text-xs">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
              m.role === "user" ? "bg-primary text-primary-foreground" :
              m.role === "system" ? "bg-muted text-muted-foreground italic" :
              "bg-card text-foreground border border-border"
            }`}>
              <pre className="whitespace-pre-wrap font-mono text-xs">{m.content}</pre>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-border flex items-center px-3 py-2 gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent text-foreground text-xs outline-none"
          placeholder="Pergunte ao AI..."
          disabled={isThinking}
        />
        <button type="submit" disabled={isThinking || !input.trim()} className="text-primary disabled:text-muted-foreground">
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

export default AIChat;
