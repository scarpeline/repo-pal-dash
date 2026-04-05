import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Settings2 } from "lucide-react";

const AI_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", desc: "Rápido e eficiente" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Equilibrado" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Mais preciso" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", desc: "OpenAI rápido" },
  { id: "openai/gpt-5", label: "GPT-5", desc: "OpenAI avançado" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", desc: "Mais econômico" },
];

type ChatMsg = { role: "user" | "ai" | "system"; content: string; timestamp: Date };

interface AIChatProps {
  messages: ChatMsg[];
  onSend: (message: string, model?: string) => void;
  isThinking: boolean;
}

const AIChat = ({ messages, onSend, isThinking }: AIChatProps) => {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSend(input.trim(), selectedModel);
    setInput("");
  };

  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--editor-bg))]">
      <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
              m.role === "user" ? "bg-primary text-primary-foreground" :
              m.role === "system" ? "bg-muted text-muted-foreground italic" :
              "bg-card text-foreground border border-border"
            }`}>
              <pre className="whitespace-pre-wrap font-mono text-sm">{m.content}</pre>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Model selector */}
      {showModelSelect && (
        <div className="border-t border-border bg-card p-2 space-y-1">
          {AI_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => { setSelectedModel(m.id); setShowModelSelect(false); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex justify-between items-center hover:bg-muted ${selectedModel === m.id ? "bg-primary/10 text-primary" : "text-foreground"}`}
            >
              <span className="font-medium">{m.label}</span>
              <span className="text-muted-foreground text-[10px]">{m.desc}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-border flex items-center px-3 py-2 gap-2">
        <button
          type="button"
          onClick={() => setShowModelSelect(!showModelSelect)}
          className="text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1"
          title={`Modelo: ${currentModel.label}`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">{currentModel.label}</span>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent text-foreground text-sm outline-none"
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
