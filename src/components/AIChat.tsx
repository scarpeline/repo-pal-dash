import { useState, useRef, useEffect } from "react";
import { 
  Send, Loader2, Settings2, ChevronDown, ChevronRight, 
  Code2, Bot, User, Copy, Check, Paperclip, X,
  FileImage, FileVideo, FileText, File as FileIcon, Wand2,
  Wallet, RefreshCw, Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Modelos específicos por provider — o que o usuário vê e seleciona
const AI_MODELS = [
  { id: "auto",                 label: "Modo Inteligente",       desc: "Roteia para código, imagem ou vídeo automaticamente", speed: "Rápido", quality: "Adaptativo", cost: "Otimizado", category: "Recomendado" },
  { id: "google-code-fast",     label: "Gemini 2.0 Flash",          desc: "Google · edição rápida de app e código", speed: "Instantâneo", quality: "Alta", cost: "Baixo", category: "Programação" },
  { id: "google-code-balanced", label: "Gemini 2.0 Flash",          desc: "Google · melhor equilíbrio para programar", speed: "Rápido", quality: "Alta", cost: "Baixo", category: "Programação" },
  { id: "google-code-pro",      label: "Gemini 1.5 Pro",            desc: "Google · código complexo, arquitetura e contexto longo", speed: "Médio", quality: "Extrema", cost: "Médio", category: "Arquitetura" },
  { id: "google-image",         label: "Gemini Imagem",             desc: "Google · criar imagens, logos e banners", speed: "Rápido", quality: "Alta", cost: "Médio", category: "Multimodal" },
  { id: "google-video",         label: "Gemini Vídeo",              desc: "Google · planejar e criar vídeos para projetos", speed: "Lento", quality: "Alta", cost: "Alto", category: "Multimodal" },
  { id: "claude-haiku",         label: "Claude 3.5 Haiku",          desc: "Anthropic · rápido para revisão e chat", speed: "Instantâneo", quality: "Média", cost: "Muito Baixo", category: "Chat" },
  { id: "claude-sonnet",        label: "Claude 3.5 Sonnet",         desc: "Anthropic · edição avançada de app e código", speed: "Rápido", quality: "Extrema", cost: "Médio", category: "Programação" },
  { id: "claude-opus",          label: "Claude 3 Opus",             desc: "Anthropic · raciocínio profundo e tarefas difíceis", speed: "Lento", quality: "Extrema", cost: "Alto", category: "Raciocínio" },
  { id: "kimi",                 label: "Kimi K1.5 Pro",             desc: "Moonshot · contexto longo e análise", speed: "Médio", quality: "Alta", cost: "Baixo", category: "Análise" },
  { id: "deepseek",             label: "DeepSeek Coder",            desc: "DeepSeek · programação, debug e refatoração", speed: "Rápido", quality: "Alta", cost: "Muito Baixo", category: "Programação" },
  { id: "openai-4o",            label: "GPT-4o",                    desc: "OpenAI · raciocínio avançado e visão", speed: "Médio", quality: "Extrema", cost: "Médio", category: "Multimodal" },
  { id: "openai-4o-mini",       label: "GPT-4o Mini",               desc: "OpenAI · inteligência rápida e econômica", speed: "Instantâneo", quality: "Média", cost: "Muito Baixo", category: "Chat" },
];

const MODEL_ID_BY_SHORT_ID: Record<string, string> = {
  "google-code-fast": "google/gemini-2.0-flash",
  "google-code-balanced": "google/gemini-2.0-flash",
  "google-code-pro": "google/gemini-1.5-pro",
  "google-image": "google/gemini-2.0-flash",
  "google-video": "google/gemini-1.5-pro",
  "claude-haiku": "anthropic/claude-3-5-haiku-20241022",
  "claude-sonnet": "anthropic/claude-3-5-sonnet-20241022",
  "claude-opus": "anthropic/claude-3-opus-20240229",
  kimi: "moonshot/kimi-k1.5-pro",
  deepseek: "deepseek/deepseek-chat",
  "openai-4o": "openai/gpt-4o",
  "openai-4o-mini": "openai/gpt-4o-mini",
};

type ChatMsg = { 
  role: "user" | "ai" | "system"; 
  content: string; 
  timestamp: Date;
  provider?: string;
  activity?: string[];
};

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: "image" | "video" | "text" | "file";
  dataUrl?: string;
  text?: string;
  frames?: string[];
  note?: string;
};

interface AIChatProps {
  messages: ChatMsg[];
  onSend: (message: string, model?: string, attachments?: ChatAttachment[], autoFix?: boolean) => void;
  isThinking: boolean;
  currentActivity?: string[];
  streamingContent?: string;
  streamingProvider?: string;
  selectedProvider?: string;
  onProviderChange?: (providerId: string) => void;
}

const MAX_UPLOAD_FILES = 6;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARS = 16_000;

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
  reader.readAsDataURL(file);
});

const readImageAsOptimizedDataUrl = async (file: File) => {
  const original = await readAsDataUrl(file);
  return await new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(original.slice(0, 260_000));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => resolve(original.slice(0, 260_000));
    image.src = original;
  });
};

const readAsText = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || "").slice(0, MAX_TEXT_CHARS));
  reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
  reader.readAsText(file);
});

const isTextFile = (file: File) =>
  file.type.startsWith("text/") || /\.(txt|md|json|csv|xml|yaml|yml|toml|js|jsx|ts|tsx|css|scss|html|py|php|java|go|rs|rb|sh|env|log)$/i.test(file.name);

const captureVideoFrames = (file: File) => new Promise<string[]>((resolve) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const frames: string[] = [];
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  const cleanup = () => URL.revokeObjectURL(url);
  const grab = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    canvas.width = Math.min(video.videoWidth, 960);
    canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.72));
  };

  video.onloadedmetadata = async () => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const times = [0.1, duration * 0.5, Math.max(duration - 0.1, 0.1)];
    for (const time of times) {
      await new Promise<void>((done) => {
        video.onseeked = () => { grab(); done(); };
        video.currentTime = Math.min(time, duration);
      });
    }
    cleanup();
    resolve(frames.slice(0, 3));
  };
  video.onerror = () => { cleanup(); resolve([]); };
  video.src = url;
});

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
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0f172a] shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
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
        <pre className="text-[13px] font-mono text-emerald-400 leading-relaxed">
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
  const renderText = (text: string) => {
    const imageMatch = text.match(/!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/);
    if (!imageMatch) return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
    const [markdown, alt, src] = imageMatch;
    return (
      <div className="space-y-2">
        {text.slice(0, imageMatch.index).trim() && <div className="whitespace-pre-wrap leading-relaxed">{text.slice(0, imageMatch.index).trim()}</div>}
        <img src={src} alt={alt || "Imagem gerada pela IA"} className="max-w-full rounded-lg border border-border" loading="lazy" />
        {text.slice((imageMatch.index || 0) + markdown.length).trim() && <div className="whitespace-pre-wrap leading-relaxed">{text.slice((imageMatch.index || 0) + markdown.length).trim()}</div>}
      </div>
    );
  };
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
          <div key={idx}>{renderText(part.content)}</div>
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
  const [availableModelIds, setAvailableModelIds] = useState<Set<string> | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [autoFix, setAutoFix] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("ai_auto_fix");
    return saved === null ? true : saved === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("ai_auto_fix", autoFix ? "1" : "0");
  }, [autoFix]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize do textarea conforme o usuário digita
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 220);
    el.style.height = `${next}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, streamingContent, currentActivity.join(',')]);

  useEffect(() => {
    setSelectedModel(selectedProvider || "auto");
  }, [selectedProvider]);

  useEffect(() => {
    supabase
      .from("ai_model_pricing")
      .select("model_id")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data?.length) setAvailableModelIds(new Set(data.map((m) => m.model_id)));
      });
  }, []);

  const handleFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList?.length) return;
    setIsReadingFiles(true);
    try {
      const slots = Math.max(MAX_UPLOAD_FILES - attachments.length, 0);
      const incoming = Array.from(fileList).slice(0, slots);
      if (fileList.length > slots) toast.warning(`Limite de ${MAX_UPLOAD_FILES} anexos por mensagem.`);

      const parsed = await Promise.all(incoming.map(async (file) => {
        if (file.size > MAX_FILE_BYTES) {
          return { id: crypto.randomUUID(), name: file.name, type: file.type || "application/octet-stream", size: file.size, kind: "file" as const, note: "Arquivo acima de 20MB; enviado só como referência de nome/tipo." };
        }
        if (file.type.startsWith("image/")) {
          return { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, kind: "image" as const, dataUrl: await readImageAsOptimizedDataUrl(file) };
        }
        if (file.type.startsWith("video/")) {
          return { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, kind: "video" as const, frames: await captureVideoFrames(file), note: "Foram extraídos quadros do vídeo para análise visual." };
        }
        if (isTextFile(file)) {
          return { id: crypto.randomUUID(), name: file.name, type: file.type || "text/plain", size: file.size, kind: "text" as const, text: await readAsText(file) };
        }
        return { id: crypto.randomUUID(), name: file.name, type: file.type || "application/octet-stream", size: file.size, kind: "file" as const, note: "Tipo binário anexado como referência; envie PDF/DOCX como texto se precisar ler o conteúdo completo." };
      }));

      setAttachments(prev => [...prev, ...parsed]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o anexo.");
    } finally {
      setIsReadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = Array.from(event.clipboardData.files || []).filter((file) => file.type.startsWith("image/"));
    if (pastedFiles.length === 0) return;
    event.preventDefault();
    await handleFiles(pastedFiles.map((file, index) => new File([file], file.name || `print-colado-${Date.now()}-${index + 1}.png`, { type: file.type || "image/png" })));
    toast.success("Print colado no chat para análise da IA.");
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  const getAttachmentIcon = (kind: ChatAttachment["kind"]) => {
    if (kind === "image") return FileImage;
    if (kind === "video") return FileVideo;
    if (kind === "text") return FileText;
    return FileIcon;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isThinking || isReadingFiles) return;
    const outgoingModel = visibleModels.some((m) => m.id === selectedModel) ? selectedModel : "auto";
    const message = input.trim() || "Analise os anexos enviados e aplique as melhorias necessárias.";
    onSend(message, outgoingModel === "auto" ? undefined : outgoingModel, attachments, autoFix);
    setInput("");
    setAttachments([]);
  };

  // Sempre exibir todos os modelos. Se algum estiver desativado pelo backend, ele cairá no fallback automático do Modo Inteligente.
  const visibleModels = AI_MODELS;
  const currentModel = visibleModels.find(m => m.id === selectedModel) || visibleModels[0] || AI_MODELS[0];

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
        <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-md ${
          isUser 
            ? "bg-primary text-primary-foreground rounded-tr-none" 
            : "bg-[#1e293b] text-white border border-white/10 rounded-tl-none shadow-lg"
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
            
            {/* Link para Carteira se houver erro de saldo */}
            {m.role === "system" && m.content.toLowerCase().includes("saldo insuficiente") && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="mt-2 w-full gap-2 border-primary/20 hover:border-primary/40 bg-primary/5"
                onClick={() => window.location.href = "/wallet?deposit=1"}
              >
                <Wallet className="w-3.5 h-3.5" />
                Recarregar agora
              </Button>
            )}
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-3">
          {messages.map((m, i) => renderMessage(m, i))}
        </div>
        
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



        {/* Barra de controles ACIMA do campo de digitação - Minimalista */}
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 mb-1">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isThinking || isReadingFiles}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-all disabled:opacity-50"
              title="Anexar arquivo"
            >
              {isReadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>

            <div className="h-4 w-[1px] bg-border/50 mx-1" />

            <button
              type="button"
              onClick={() => setAutoFix((v) => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                autoFix
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : "text-muted-foreground border-transparent hover:bg-muted"
              }`}
            >
              <Check className="w-3 h-3" />
              Auto-fix
            </button>

            <button
              type="button"
              onClick={() => setShowModelSelect(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Brain className="w-3 h-3 text-primary" />
              <span>{selectedModel === "auto" ? "Modo Inteligente" : currentModel.label}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => setInput("Refatore este código...")}
              title="Refatorar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-emerald-500"
              onClick={() => setInput("Corrija os bugs...")}
              title="Fix Bugs"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Overlay de Seleção de IA - Expandido até o topo */}
        {showModelSelect && (
          <div className="absolute left-0 right-0 bottom-full z-[100] bg-background/98 backdrop-blur-md p-4 flex flex-col animate-in slide-in-from-bottom-full duration-300 border-t border-x border-border rounded-t-2xl shadow-2xl" style={{ height: 'calc(100vh - 200px)', maxHeight: '600px' }}>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Modelos de IA</h3>
                  <p className="text-[10px] text-muted-foreground">Escolha o cérebro do seu projeto</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowModelSelect(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {/* Opção Auto-Inteligente Premium */}
              <button
                type="button"
                onClick={() => {
                  setSelectedModel("auto");
                  onProviderChange?.("auto");
                  setShowModelSelect(false);
                  toast.success("🧠 Modo Inteligente ativado");
                }}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${
                  selectedModel === "auto" 
                    ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]" 
                    : "bg-card border-border/50 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Wand2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-bold text-sm block">Modo Inteligente</span>
                      <span className="text-[10px] text-primary font-medium px-2 py-0.5 bg-primary/10 rounded-full">Recomendado</span>
                    </div>
                  </div>
                  {selectedModel === "auto" && <Check className="w-5 h-5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-[52px]">
                  Roteamento inteligente que escolhe a melhor IA baseado na complexidade da sua tarefa.
                </p>
              </button>

              <div className="flex items-center gap-3 py-4">
                <div className="h-[1px] flex-1 bg-border/50" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Modelos Profissionais</span>
                <div className="h-[1px] flex-1 bg-border/50" />
              </div>

              {/* Grid de Cards Modernos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleModels.filter(m => m.id !== 'auto').map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(opt.id);
                      onProviderChange?.(opt.id);
                      setShowModelSelect(false);
                      toast.success(`Modelo ${opt.label} selecionado`);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-md ${
                      selectedModel === opt.id 
                        ? "bg-primary/5 border-primary ring-1 ring-primary/20" 
                        : "bg-card/50 border-border/60 hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs group-hover:text-primary transition-colors">{opt.label}</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5">{opt.category}</span>
                      </div>
                      {selectedModel === opt.id && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                      {opt.desc}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-muted rounded border border-border/50 text-muted-foreground uppercase tracking-tighter">Velocidade: {opt.speed}</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-muted rounded border border-border/50 text-muted-foreground uppercase tracking-tighter">Qualidade: {opt.quality}</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-muted rounded border border-border/50 text-muted-foreground uppercase tracking-tighter">Custo: {opt.cost}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-xl text-center">
              <p className="text-[10px] text-muted-foreground italic">
                A IAProgramador utiliza os modelos mais avançados do mercado para garantir a qualidade do seu código.
              </p>
            </div>
          </div>
        )}

        {/* Campo de digitação elegante e compacto */}
        <div className="flex items-end gap-2 bg-muted/20 border border-border/40 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/20 transition-all shadow-inner">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            rows={1}
            style={{ color: "hsl(var(--foreground))", caretColor: "hsl(var(--primary))" }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none leading-relaxed max-h-[180px] overflow-y-auto"
            placeholder={isThinking ? "Processando..." : "Pergunte algo ou peça uma alteração..."}
            disabled={isThinking}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />

          <Button
            type="submit"
            disabled={isThinking || isReadingFiles || (!input.trim() && attachments.length === 0)}
            size="sm"
            className="shrink-0 h-8 w-8 p-0 rounded-lg shadow-sm transition-transform active:scale-95"
          >
            {isThinking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
