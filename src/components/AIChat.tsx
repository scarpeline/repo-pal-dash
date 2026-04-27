import { useState, useRef, useEffect } from "react";
import { 
  Send, Loader2, Settings2, ChevronDown, ChevronRight, 
  Sparkles, Zap, Code2, Bot, User, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AISelector } from "./AISelector";

// Modelos específicos por provider — o que o usuário vê e seleciona
const AI_MODELS = [
  { id: "auto",                 label: "🧠 Auto inteligente",       desc: "Roteia para código, imagem ou vídeo automaticamente" },
  { id: "google-code-fast",     label: "Gemini 3 Flash",            desc: "Google · edição rápida de app e código" },
  { id: "google-code-balanced", label: "Gemini 2.5 Flash",          desc: "Google · melhor equilíbrio para programar" },
  { id: "google-code-pro",      label: "Gemini 2.5 Pro",            desc: "Google · código complexo, arquitetura e contexto longo" },
  { id: "google-image",         label: "Gemini Imagem",             desc: "Google · criar imagens, logos e banners" },
  { id: "google-video",         label: "Gemini Vídeo",              desc: "Google · planejar e criar vídeos para projetos" },
];

type ChatMsg = { 
  role: "user" | "ai" | "system"; 
  content: string; 
  timestamp: Date;
  provider?: string;
  activity?: string[];
};

interface AIChatProps {
  messages: ChatMsg[];
  onSend: (message: string, model?: string) => void;
  isThinking: boolean;
  currentActivity?: string[];
  streamingContent?: string;
  streamingProvider?: string;
  selectedProvider?: string;
  onProviderChange?: (providerId: string) => void;
}

// 🎨 Componente de bloco de código colapsável
const CodeBlock = ({ code, language }: { code: string; language?: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const lines = code.split('\n');
  const displayLines = isExpanded ? lines : lines.slice(0, 3);
  const hasMore = lines.length > 3;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border bg-[#1e1e2e] animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d3d] border-b border-border">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">{language || 'code'}</span>
          <span className="text-xs text-muted-foreground">({lines.length} linhas)</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-white/10"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </Button>
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-white/10"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="ml-1">{isExpanded ? 'Recolher' : `+${lines.length - 3}`}</span>
            </Button>
          )}
        </div>
      </div>
      
      {/* Code content */}
      <div className="p-3 overflow-x-auto">
        <pre className="text-xs font-mono text-green-400 leading-relaxed">
          {displayLines.join('\n')}
          {!isExpanded && hasMore && (
            <span className="text-muted-foreground block mt-1">...</span>
          )}
        </pre>
      </div>
    </div>
  );
};

// 🎨 Componente de indicador de atividade (estilo Windsurf)
const ActivityIndicator = ({ activities }: { activities: string[] }) => {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      {activities.map((activity, idx) => (
        <div
          key={idx}
          className={`flex items-center gap-2 text-xs animate-in fade-in slide-in-from-left-2 duration-300`}
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          {idx === activities.length - 1 ? (
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
          ) : (
            <Check className="w-3 h-3 text-green-500" />
          )}
          <span className={idx === activities.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
            {activity}
          </span>
        </div>
      ))}
    </div>
  );
};

// 🎨 Componente de mensagem de streaming com efeito de digitação
const StreamingMessage = ({ content, provider }: { content: string; provider?: string }) => {
  const [displayedContent, setDisplayedContent] = useState("");
  
  useEffect(() => {
    // Efeito de digitação gradual
    if (displayedContent.length < content.length) {
      const timer = setTimeout(() => {
        const nextChunk = Math.min(displayedContent.length + 5, content.length);
        setDisplayedContent(content.slice(0, nextChunk));
      }, 15);
      return () => clearTimeout(timer);
    }
  }, [content, displayedContent]);
  
  // Quando o content muda completamente, reset
  useEffect(() => {
    if (content.length < displayedContent.length) {
      setDisplayedContent(content);
    }
  }, [content]);
  
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 max-w-[90%] animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="w-4 h-4 text-primary" />
        <span className="text-xs text-muted-foreground">IA Programador</span>
        {provider && (
          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
            {provider}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-xs text-primary">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          escrevendo
        </span>
      </div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">
        {displayedContent}
        {displayedContent.length < content.length && (
          <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
};

// 🎨 Parser de conteúdo para separar texto e código
const ParsedContent = ({ content }: { content: string }) => {
  const parts: Array<{type: 'text' | 'code'; content: string; language?: string}> = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Texto antes do código
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }
    
    // Bloco de código
    parts.push({
      type: 'code',
      language: match[1],
      content: match[2].trim()
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Texto restante
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }
  
  // Se não encontrou nenhum bloco de código, retorna o conteúdo completo
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }
  
  return (
    <>
      {parts.map((part, idx) => (
        part.type === 'code' ? (
          <CodeBlock key={idx} code={part.content} language={part.language} />
        ) : (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed">{part.content}</div>
        )
      ))}
    </>
  );
};

const AIChat = ({ 
  messages, 
  onSend, 
  isThinking, 
  currentActivity = [],
  streamingContent,
  streamingProvider,
  selectedProvider = "auto",
  onProviderChange 
}: AIChatProps) => {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(selectedProvider);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, streamingContent, currentActivity.join(',')]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSend(input.trim(), selectedModel === "auto" ? undefined : selectedModel);
    setInput("");
  };

  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

  // Renderização de mensagem individual
  const renderMessage = (m: ChatMsg, idx: number) => {
    const isUser = m.role === "user";
    const isSystem = m.role === "system";
    
    if (isSystem) {
      return (
        <div 
          key={idx}
          className="flex justify-center my-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1.5 rounded-full italic border border-border/50">
            {m.content}
          </div>
        </div>
      );
    }
    
    return (
      <div 
        key={idx}
        className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
      >
        <div className={`max-w-[90%] rounded-lg px-4 py-3 shadow-sm ${
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-card text-foreground border border-border"
        }`}>
          {/* Header da mensagem */}
          <div className="flex items-center gap-2 mb-2">
            {isUser ? (
              <User className="w-4 h-4 opacity-70" />
            ) : (
              <Bot className="w-4 h-4 text-primary" />
            )}
            <span className="text-xs opacity-70 font-medium">
              {isUser ? 'Você' : 'IA Programador'}
            </span>
            {m.provider && !isUser && (
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                {m.provider}
              </span>
            )}
          </div>
          
          {/* Conteúdo da mensagem */}
          <div className="text-sm">
            <ParsedContent content={m.content} />
          </div>
          
          {/* Atividades (se houver) */}
          {m.activity && m.activity.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border/50">
              <ActivityIndicator activities={m.activity} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      
      {/* Área de mensagens */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map((m, i) => renderMessage(m, i))}
        
        {/* Indicador de streaming */}
        {streamingContent && (
          <StreamingMessage 
            content={streamingContent} 
            provider={streamingProvider || currentModel.label}
          />
        )}
        
        {/* Indicador de atividades atuais */}
        {isThinking && currentActivity.length > 0 && !streamingContent && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="bg-card border border-border rounded-lg px-4 py-3 max-w-[90%] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-primary animate-pulse" />
                </div>
                <span className="text-xs text-primary font-medium">IA trabalhando...</span>
              </div>
              <ActivityIndicator activities={currentActivity} />
            </div>
          </div>
        )}
        
        {/* Indicador simples de pensando */}
        {isThinking && currentActivity.length === 0 && !streamingContent && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Seletor de modelo (dropdown) — abre para cima, altura máxima */}
      {showModelSelect && (
        <div className="border-t border-border bg-card overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          <div className="p-2 space-y-1 overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {AI_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m.id); setShowModelSelect(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex flex-col gap-0.5 hover:bg-muted transition-all duration-200 ${
                  selectedModel === m.id ? "bg-primary/10 text-primary border border-primary/20" : "text-foreground"
                }`}
              >
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground text-xs">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-card p-3">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <button
            type="button"
            onClick={() => setShowModelSelect(!showModelSelect)}
            className="text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1.5 transition-colors p-1 hover:bg-white/5 rounded"
            title={`Modelo: ${currentModel.label}`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="text-xs hidden sm:inline max-w-[100px] truncate">
              {currentModel.label}
            </span>
          </button>
          
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground min-h-[20px]"
            placeholder={isThinking ? "Aguarde a resposta..." : "Pergunte ao AI ou peça para editar arquivos..."}
            disabled={isThinking}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          
          <Button 
            type="submit" 
            disabled={isThinking || !input.trim()} 
            size="sm"
            className="shrink-0 h-8 w-8 p-0 rounded-lg"
          >
            {isThinking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
