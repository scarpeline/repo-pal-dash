import { useState, useCallback, useEffect, useRef } from "react";
import {
  PanelLeftClose, PanelLeftOpen, FolderGit2, Terminal, MessageSquare,
  Eye, X, FileCode, Search, GitBranch, Github, Loader2, Save,
  Wallet, Gift, LogOut, Code2, Globe, Menu, ChevronLeft
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipe } from "@/hooks/use-swipe";
import MobileBottomNav from "@/components/MobileBottomNav";
import logoImg from "@/assets/logo-iaprogramador.png";
import FileTree from "@/components/FileTree";
import CodeEditorPanel from "@/components/CodeEditorPanel";
import TerminalPanel from "@/components/TerminalPanel";
import AIChat, { type ChatAttachment } from "@/components/AIChat";
import PreviewPanel from "@/components/PreviewPanel";
import UserBalanceBar from "@/components/UserBalanceBar";
import GitHubConnect from "@/components/GitHubConnect";
import RepoBrowser from "@/components/RepoBrowser";
import CommitBar from "@/components/CommitBar";
import AuthErrorHandler from "@/components/AuthErrorHandler";
import NotificationBell from "@/components/NotificationBell";
import {
  getToken, clearToken, getStoredUser,
  getRepoTree, getFileContent, listBranches, parseRepoUrl, getRepoByUrl,
  type GHRepo, type GHBranch, type FileNode,
} from "@/lib/github";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatUsageText } from "@/utils/credits";
import { toast } from "sonner";
import { AIFileModifier } from "@/lib/aiFileModifier";
import { useLanguage } from "@/contexts/LanguageContext";

type Tab = { path: string; name: string; content: string; sha?: string; dirty?: boolean };
type TermMsg = { type: "input" | "output" | "error" | "system" | "success"; text: string; timestamp: Date };
type ChatMsg = {
  role: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
  provider?: string;
  activity?: string[];
};

const MAX_CHAT_CONTEXT_MESSAGES = 10;
// Sempre que houver repositório conectado e a frase tiver QUALQUER intenção de ação/análise,
// o agente assume o controle, varre o repositório e responde com base no código real.
// Assim o usuário não precisa decorar comandos como "/edit" e a IA não responde mais
// "me envie os arquivos" — ela já tem acesso ao repositório.
const REPO_AGENT_ACTION_REGEX = /\b(corrig\w*|conserta\w*|arrum\w*|fix\w*|debug\w*|refator\w*|edit\w*|alter\w*|mud\w*|troc\w*|cri\w*|adicion\w*|remov\w*|delet\w*|apag\w*|implement\w*|ajust\w*|otimiz\w*|melhor\w*|atualiz\w*|resolv\w*|analis\w*|revis\w*|verific\w*|inspecion\w*|scan\w*|varr\w*|le\w*\s+(o|os|esse|esses|este|estes)\s+(arquivo|c[oó]digo|repo)|tela\s+branca|white\s*screen)\b/i;
const REPO_AGENT_QUESTION_REGEX = /\b(o\s+que|porque|por\s*que|como\s+(funciona|est[aá]|fa[çc]o)|onde\s+est[aá]|qual\s+(arquivo|fun[çc][aã]o|componente))\b/i;

const shouldUseRepositoryAgent = (message: string, hasRepo: boolean, hasAttachments = false) => {
  if (!hasRepo) return false;
  if (hasAttachments) return true;
  // Saudações/agradecimentos curtos continuam no chat normal.
  if (/^(oi|ol[aá]|obrigado|obrigada|valeu|bom dia|boa tarde|boa noite|ok|sim|n[aã]o|tchau)[!.\s]*$/i.test(message.trim())) return false;
  // Com repositório conectado, qualquer outra mensagem aciona o agente — ele já tem o código.
  return true;
};

const summarizeAttachmentsForPrompt = (attachments: ChatAttachment[] = [], includeMediaData = false) => {
  if (!attachments.length) return "";
  const parts = attachments.map((file, index) => {
    const base = `Anexo ${index + 1}: ${file.name} (${file.type || file.kind}, ${(file.size / 1024).toFixed(1)} KB)`;
    if (file.kind === "text" && file.text) return `${base}\nConteúdo:\n\`\`\`\n${file.text}\n\`\`\``;
    if (file.kind === "image" && file.dataUrl) return includeMediaData ? `${base}\nImagem em data URL para análise visual: ${file.dataUrl.slice(0, 180_000)}` : `${base}\nImagem anexada para análise visual.`;
    if (file.kind === "video" && file.frames?.length) return includeMediaData ? `${base}\nQuadros extraídos do vídeo para análise visual:\n${file.frames.map((frame, i) => `Frame ${i + 1}: ${frame.slice(0, 120_000)}`).join("\n")}` : `${base}\nVídeo anexado; ${file.frames.length} quadros foram extraídos para análise visual.`;
    return `${base}\nObservação: ${file.note || "Arquivo anexado como referência."}`;
  });
  return `\n\nANEXOS ENVIADOS PELO USUÁRIO:\n${parts.join("\n\n")}`;
};

const buildChatContext = (messages: ChatMsg[], latestMessage: string) => [
  ...messages
    .filter((message) => message.role !== "system")
    .slice(-MAX_CHAT_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.role === "ai" ? "assistant" : "user",
      content: message.content,
    })),
  { role: "user", content: latestMessage },
];

const getModelBadge = (model?: string) => {
  const badges: Record<string, string> = {
    auto: "Auto",
    gemini: "Google Gemini",
    "google-code-fast": "Gemini 2.0 Flash",
    "google-code-balanced": "Gemini 2.0 Flash",
    "google-code-pro": "Gemini 1.5 Pro",
    "google-image": "Gemini Imagem",
    "google-video": "Gemini Vídeo",
    deepseek: "DeepSeek",
    groq: "Groq",
    "groq-8b": "Groq 8B",
    kimi: "Kimi",
    openrouter: "OpenRouter",
    "claude-haiku": "Claude 3.5 Haiku",
    "claude-sonnet": "Claude 3.5 Sonnet",
    "claude-opus": "Claude 3 Opus",
    openai: "GPT-4o mini",
  };

  return badges[model || "auto"] || model || "Auto";
};

const EditorPage = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Mobile: sidebar começa fechada, desktop: começa aberta
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  
  const [sidebarTab, setSidebarTab] = useState<"files" | "github" | "search">("github");

  const [ghToken, setGhToken] = useState<string | null>(null);
  const [ghUser, setGhUser] = useState<{ login: string; avatar_url: string; name: string } | null>(null);
  const [ghView, setGhView] = useState<"connect" | "repos" | "connected">("connect");
  const [selectedRepo, setSelectedRepo] = useState<GHRepo | null>(null);
  const [branch, setBranch] = useState("main");
  const [branches, setBranches] = useState<GHBranch[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"terminal" | "chat">("chat");
  
  // Mobile: painéis começam fechados, desktop: começam abertos
  const [bottomOpen, setBottomOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  
  const [showPreview, setShowPreview] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [loadingFile, setLoadingFile] = useState(false);
  const [repoUrls, setRepoUrls] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("repo_preview_urls") || "{}"); } catch { return {}; }
  });

  const handleUrlChange = useCallback((newUrl: string) => {
    if (!selectedRepo) return;
    setRepoUrls(prev => {
      const next = { ...prev, [selectedRepo.full_name]: newUrl };
      localStorage.setItem("repo_preview_urls", JSON.stringify(next));
      return next;
    });
  }, [selectedRepo]);

  const [termMessages, setTermMessages] = useState<TermMsg[]>([
    { type: "system", text: "IAProgramador Terminal v2.0 — Conecte seu GitHub para começar.", timestamp: new Date() },
  ]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: "system", content: "Bem-vindo ao IAProgramador! 🚀\n\nSou um agente autônomo. Você não precisa usar comandos específicos.\n\nSimplesmente converse comigo e diga o que você deseja mudar, corrigir ou criar, e eu mapearei o repositório e farei o trabalho pra você! Se apenas tiver uma dúvida, pode me perguntar livremente.", timestamp: new Date() },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [streamingProvider, setStreamingProvider] = useState<string>("");
  const [activeProvider, setActiveProvider] = useState<string>("auto");
  const [showCredit, setShowCredit] = useState(true);
  const [searchParams] = useSearchParams();
  const mainContentRef = useRef<HTMLDivElement>(null);

  // 🎨 Swipe gestures para mobile - swipe da esquerda abre sidebar, da direita fecha
  const { ref: swipeRef } = useSwipe(
    () => setSidebarOpen(false), // swipe left fecha sidebar
    () => setSidebarOpen(true),   // swipe right abre sidebar
    undefined, // swipe up - não usado
    undefined  // swipe down - não usado
  );

  // 🎨 Fechar painéis ao redimensionar para mobile
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      if (isMobileView) {
        // Em mobile, fecha painéis para dar mais espaço
        if (sidebarOpen && bottomOpen) {
          setBottomOpen(false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen, bottomOpen]);

  useEffect(() => {
    const initAuth = async () => {
      if (searchParams.get("gh_connected") === "1") {
        const stored = getToken();
        const storedUser = getStoredUser();
        if (stored && storedUser) {
          const { validateToken } = await import("@/lib/github");
          const validation = await validateToken(stored);
          if (validation.valid) {
            setGhToken(stored);
            setGhUser(storedUser);
            setGhView("repos");
            setSidebarTab("github");
          } else { clearToken(); }
        }
        return;
      }
      const stored = getToken();
      if (stored) {
        const { validateToken } = await import("@/lib/github");
        const validation = await validateToken(stored);
        if (validation.valid && validation.user) {
          setGhToken(stored);
          setGhUser(validation.user);
          localStorage.setItem("gh_user", JSON.stringify(validation.user));
          setGhView("repos");
          setSidebarTab("github");
        } else { clearToken(); }
      }
    };
    initAuth();
  }, []);

  const handleGhDisconnect = useCallback(() => {
    clearToken(); setGhToken(null); setGhUser(null); setGhView("connect");
    setSelectedRepo(null); setFiles([]); setOpenTabs([]); setActiveTab(null);
  }, []);

  const handleSelectRepo = useCallback(async (repo: GHRepo) => {
    if (!ghToken) return;
    setSelectedRepo(repo); setBranch(repo.default_branch); setGhView("connected");
    setSidebarTab("files"); setLoadingTree(true); setOpenTabs([]); setActiveTab(null);
    try {
      const [tree, branchList] = await Promise.all([
        getRepoTree(ghToken, repo.owner.login, repo.name, repo.default_branch),
        listBranches(ghToken, repo.owner.login, repo.name),
      ]);
      setFiles(tree); setBranches(branchList);
      setTermMessages(p => [...p, { type: "success", text: `✓ ${repo.full_name} clonado (${branchList.length} branches)`, timestamp: new Date() }]);
    } catch (err: any) {
      setTermMessages(p => [...p, { type: "error", text: `✗ ${err.message}`, timestamp: new Date() }]);
    }
    setLoadingTree(false);
  }, [ghToken]);

  const handleCloneUrl = useCallback(async (url: string) => {
    if (!ghToken) return;
    const parsed = parseRepoUrl(url);
    if (!parsed) { setTermMessages(p => [...p, { type: "error", text: "✗ URL inválida", timestamp: new Date() }]); return; }
    try { const repo = await getRepoByUrl(ghToken, parsed.owner, parsed.repo); handleSelectRepo(repo); } catch (err: any) {
      setTermMessages(p => [...p, { type: "error", text: `✗ ${err.message}`, timestamp: new Date() }]);
    }
  }, [ghToken, handleSelectRepo]);

  const handleBranchChange = useCallback(async (newBranch: string) => {
    if (!ghToken || !selectedRepo) return;
    setBranch(newBranch); setLoadingTree(true); setOpenTabs([]); setActiveTab(null);
    try {
      const tree = await getRepoTree(ghToken, selectedRepo.owner.login, selectedRepo.name, newBranch);
      setFiles(tree);
    } catch {}
    setLoadingTree(false);
  }, [ghToken, selectedRepo]);

  const handleFileSelect = useCallback(async (node: FileNode) => {
    if (node.type !== "file" || !ghToken || !selectedRepo) return;
    const existing = openTabs.find(t => t.path === node.path);
    if (existing) { setActiveTab(node.path); return; }
    setLoadingFile(true);
    try {
      const { content, sha } = await getFileContent(ghToken, selectedRepo.owner.login, selectedRepo.name, node.path, branch);
      setOpenTabs(prev => [...prev, { path: node.path, name: node.name, content, sha, dirty: false }]);
      setActiveTab(node.path);
    } catch (err: any) {
      setTermMessages(p => [...p, { type: "error", text: `✗ ${err.message}`, timestamp: new Date() }]);
    }
    setLoadingFile(false);
  }, [openTabs, ghToken, selectedRepo, branch]);

  const handleCloseTab = useCallback((path: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== path);
      if (activeTab === path) setActiveTab(next.length > 0 ? next[next.length - 1].path : null);
      return next;
    });
  }, [activeTab]);

  const handleEditorChange = useCallback((content: string) => {
    setOpenTabs(prev => prev.map(t => t.path === activeTab ? { ...t, content, dirty: true } : t));
  }, [activeTab]);

  const handleCommitSuccess = useCallback((newSha: string, commitUrl: string) => {
    setOpenTabs(prev => prev.map(t => t.path === activeTab ? { ...t, sha: newSha, dirty: false } : t));
    setTermMessages(p => [...p, { type: "success", text: `✓ Commit realizado!`, timestamp: new Date() }]);
  }, [activeTab]);

  const handleTermCommand = useCallback((cmd: string) => {
    setTermMessages(p => [...p, { type: "input", text: cmd, timestamp: new Date() }]);
    setTimeout(() => {
      if (cmd === "clear") setTermMessages([{ type: "system", text: "Terminal limpo.", timestamp: new Date() }]);
      else if (cmd === "help") setTermMessages(p => [...p, { 
        type: "output", 
        text: `Comandos: help, clear, status, whoami\n\n🤖 **Comandos IA no Chat (Controle Total):**
• "muda a cor do botão para azul"
• "altera a cor da header para vermelho" 
• "troca o texto Bem-vindo para Olá"
• "adiciona um footer no site"
• "cria um header com navegação"
• "corrige o bug do formulário"
• "arruma o erro de login"
• "atualiza o estilo dos cards"
• "melhora o design dos botões"

🔧 **O IAProgramador tem controle total sobre qualquer repositório conectado!**
📁 Varre todos os arquivos automaticamente
⚡ Modifica e salva direto no GitHub
🎯 Funciona com React, TypeScript, CSS, JavaScript`, 
        timestamp: new Date() 
      }]);
      else if (cmd === "whoami") setTermMessages(p => [...p, { type: "output", text: ghUser ? `@${ghUser.login}` : "Não conectado", timestamp: new Date() }]);
      else if (cmd === "status") setTermMessages(p => [...p, { type: "output", text: selectedRepo ? `Repo: ${selectedRepo.full_name} | Branch: ${branch}` : "Nenhum repo selecionado", timestamp: new Date() }]);
      else setTermMessages(p => [...p, { type: "output", text: `Comando não reconhecido. Digite "help"`, timestamp: new Date() }]);
    }, 200);
  }, [ghUser, selectedRepo, branch]);

  const activeFile = openTabs.find(t => t.path === activeTab);

  // Manipula modificações de arquivos via IA
  const handleFileModification = async (message: string, model?: string, attachments: ChatAttachment[] = [], autoFix: boolean = true) => {
    if (!selectedRepo) {
      setChatMessages(p => [...p, { role: "ai", content: "❌ Nenhum repositório selecionado.", timestamp: new Date() }]);
      return;
    }

    const requestedModel = model || activeProvider || "auto";
    const providerBadge = getModelBadge(requestedModel);

    try {
      const modifier = new AIFileModifier(ghToken!, selectedRepo, branch);
      const activityLog = ["🤖 Analisando solicitação..."];

      const addProgress = (msg: string) => {
        activityLog.push(msg);
        const nextActivity = activityLog.slice(-5);
        activityLog.splice(0, activityLog.length, ...nextActivity);
        setCurrentActivity(nextActivity);
      };

      setCurrentActivity(activityLog);
      setStreamingProvider(providerBadge);
      setStreamingContent("");

      const autoFixDirective = autoFix
        ? `\n\n[MODO CORREÇÃO AUTOMÁTICA ATIVADO]\nAlém de atender o pedido acima, varra os arquivos relevantes do repositório, identifique bugs evidentes, imports quebrados, conflitos, problemas de tipagem, runtime errors e tela branca, e inclua as correções necessárias no mesmo conjunto de "modifications". Se encontrar melhorias seguras (acessibilidade, performance trivial, código morto), aplique-as também e explique cada alteração no "summary". Nunca peça arquivos ao usuário — você já tem o repositório.`
        : `\n\n[MODO CORREÇÃO AUTOMÁTICA DESATIVADO]\nFaça apenas o que foi pedido. Não aplique correções extras nem refatore o que não foi solicitado.`;
      const commandWithAttachments = `${message}${summarizeAttachmentsForPrompt(attachments, true)}${autoFixDirective}`;
      const result = await modifier.processCommand(
        commandWithAttachments,
        requestedModel,
        addProgress,
        chatMessages.filter(m => m.role !== "system").slice(-8)
      );

      if (result.modifications.length === 0) {
        const usageInfo = result.usage
          ? `\n\n💰 Custo da ação: R$ ${(result.usage.cost_cents / 100).toFixed(4)}`
          : "";
        setChatMessages(p => [...p, {
          role: "ai",
          content: result.message + usageInfo,
          timestamp: new Date(),
          provider: result.provider || providerBadge,
          activity: [...activityLog],
        }]);
        setCurrentActivity([]);
        setStreamingContent("");
        setStreamingProvider("");
        return;
      }

      addProgress("⚡ Aplicando alterações no GitHub...");
      const executionResult = await modifier.executeModifications(result.modifications);
      const usageInfo = result.usage
        ? `\n\n💰 Custo da ação: R$ ${(result.usage.cost_cents / 100).toFixed(4)}`
        : "";

      setChatMessages(p => [...p, {
        role: "ai",
        content: `${result.message}\n\n${executionResult}${usageInfo}`,
        timestamp: new Date(),
        provider: result.provider || providerBadge,
        activity: [...activityLog, "✅ Alterações aplicadas com sucesso!"],
      }]);

      setCurrentActivity([]);
      setStreamingContent("");
      setStreamingProvider("");

      // Refresh file tree
      setLoadingTree(true);
      try {
        const tree = await getRepoTree(ghToken!, selectedRepo.owner.login, selectedRepo.name, branch);
        setFiles(tree);
        const modifiedPaths = new Set(result.modifications.map(m => m.path));
        for (const tab of openTabs) {
          if (modifiedPaths.has(tab.path)) {
            const { content, sha } = await getFileContent(ghToken!, selectedRepo.owner.login, selectedRepo.name, tab.path, branch);
            setOpenTabs(prev => prev.map(t => t.path === tab.path ? { ...t, content, sha, dirty: false } : t));
          }
        }
      } catch (error) {
        console.error('Error refreshing file tree:', error);
      }
      setLoadingTree(false);

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(errMsg);
      setChatMessages(p => [...p, { role: "ai", content: `❌ Erro: ${errMsg}`, timestamp: new Date(), provider: providerBadge }]);
      setCurrentActivity([]);
      setStreamingContent("");
      setStreamingProvider("");
    }
  };

  const handleChatSend = useCallback(async (message: string, model?: string, attachments: ChatAttachment[] = [], autoFix: boolean = true) => {
    const requestedModel = model || activeProvider || "auto";
    const providerBadge = getModelBadge(requestedModel);

    try {
      const { supabase: sb } = await import("@/integrations/supabase/client");
      const { data: bal } = await sb.from("balances").select("balance_cents").eq("user_id", user?.id).single();
      if (!bal || bal.balance_cents <= 0) {
        setChatMessages(p => [...p,
          { role: "user", content: message, timestamp: new Date() },
          { role: "system", content: "⚠️ Saldo insuficiente. Recarregue sua carteira para usar a IA. Acesse a página Carteira para adquirir um pacote.", timestamp: new Date() }
        ]);
        return;
      }
    } catch (e) {
      console.error("Balance check error", e);
    }

    const attachmentLabel = attachments.length
      ? `\n\n📎 ${attachments.length} anexo(s): ${attachments.map(a => a.name).join(", ")}`
      : "";
    const autoFixLabel = autoFix && ghToken && selectedRepo ? " · 🪄 Auto-fix ON" : "";
    setChatMessages(p => [...p, { role: "user", content: `${message}${attachmentLabel}${autoFixLabel}`, timestamp: new Date() }]);
    setIsThinking(true);

    try {
      if (ghToken && selectedRepo && shouldUseRepositoryAgent(message, true, attachments.length > 0)) {
        await handleFileModification(message, requestedModel === "auto" ? undefined : requestedModel, attachments, autoFix);
        setIsThinking(false);
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { supabase } = await import("@/integrations/supabase/client");
      const session = (await supabase.auth.getSession()).data.session;
      const messageWithAttachments = `${message}${summarizeAttachmentsForPrompt(attachments, true)}`;
      const messages = buildChatContext(chatMessages, messageWithAttachments);

      setCurrentActivity(["🤖 Conectando à IA..."]);
      setStreamingProvider(providerBadge);
      setStreamingContent("");

      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages,
          fileContent: activeFile?.content,
          fileName: activeFile?.name,
          model: requestedModel,
          attachments,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({} as Record<string, unknown>));
        const errorMsg = (errData as { error?: string }).error || `Erro: ${res.status}`;

        if (res.status === 402 && (errData as { code?: string }).code === "INSUFFICIENT_BALANCE") {
          toast.error("Saldo insuficiente para essa solicitação.");
          setChatMessages(p => [...p, {
            role: "system",
            content: `⚠️ ${errorMsg}

💳 Clique em "Carteira" no menu superior para recarregar.`,
            timestamp: new Date()
          }]);
        } else if (res.status === 429) {
          toast.error("Limite temporário atingido. Tente novamente em instantes.");
          setChatMessages(p => [...p, {
            role: "system",
            content: `⚠️ ${errorMsg}`,
            timestamp: new Date()
          }]);
        } else if (res.status === 503) {
          const tried = (errData as { tried_models?: string[] }).tried_models;
          const triedLine = tried?.length
            ? `\n\nModelos tentados no servidor: ${tried.join(", ")}.`
            : "";
          const hint = tried?.length
            ? "\n\nO roteador tentou os modelos disponíveis. Confira créditos e limites das integrações de IA."
            : "";
          const fullMsg = `${errorMsg}${triedLine}${hint}`;
          toast.error("Nenhuma IA respondeu após tentar os provedores disponíveis.");
          setChatMessages(p => [...p, {
            role: "system",
            content: `⚠️ ${fullMsg}`,
            timestamp: new Date(),
          }]);
        } else {
          toast.error(errorMsg);
          setChatMessages(p => [...p, {
            role: "ai",
            content: `❌ ${errorMsg}`,
            timestamp: new Date(),
            provider: providerBadge,
          }]);
        }

        setIsThinking(false);
        setCurrentActivity([]);
        setStreamingContent("");
        setStreamingProvider("");
        return;
      }

      const data = await res.json();
      const aiContent = data.content || "Sem resposta do modelo.";
      const provider = data.provider || providerBadge;
      const usageInfo = data.usage
        ? `\n\n💰 Custo da ação: R$ ${(data.usage.cost_cents / 100).toFixed(4)}`
        : "";

      // 🌊 Streamer visual: revela a resposta em chunks antes de consolidar
      setCurrentActivity([]);
      const fullText = aiContent + usageInfo;
      const chunkSize = Math.max(8, Math.ceil(fullText.length / 60));
      for (let i = chunkSize; i < fullText.length; i += chunkSize) {
        setStreamingContent(fullText.slice(0, i));
        await new Promise(r => setTimeout(r, 18));
      }
      setStreamingContent(fullText);
      await new Promise(r => setTimeout(r, 80));

      setChatMessages(p => [...p, {
        role: "ai",
        content: fullText,
        timestamp: new Date(),
        provider,
        activity: ["✅ Resposta recebida"],
      }]);
      setStreamingContent("");
      setCurrentActivity([]);
      setStreamingProvider("");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(errMsg);
      setChatMessages(p => [...p, { role: "ai", content: `Erro: ${errMsg}`, timestamp: new Date(), provider: providerBadge }]);
      setCurrentActivity([]);
      setStreamingContent("");
      setStreamingProvider("");
    }
    setIsThinking(false);
  }, [selectedRepo, branch, activeFile, chatMessages, ghToken, activeProvider, user?.id]);

  const renderFileTree = (nodes: FileNode[]) => (
    <div className="text-sm">
      {nodes.map(node => (
        <div key={node.path}>
          <button
            onClick={() => handleFileSelect(node)}
            className={`w-full text-left px-3 py-1 hover:bg-muted/50 flex items-center gap-1.5 ${
              activeTab === node.path ? "bg-muted text-foreground" : "text-muted-foreground"
            } ${node.type === "dir" ? "font-medium" : ""}`}
            style={{ paddingLeft: `${(node.path.split("/").length - 1) * 12 + 12}px` }}
          >
            {node.type === "dir" ? <FolderGit2 className="w-3 h-3 text-[hsl(var(--warning))]" /> : <FileCode className="w-3 h-3 text-primary" />}
            {node.name}
          </button>
          {node.type === "dir" && node.children && renderFileTree(node.children)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background p-2 gap-2 text-foreground font-sans relative">
      <AuthErrorHandler />

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden gap-2">
        {/* Title bar - Mobile otimizado */}
        <div className="h-14 md:h-12 bg-card border border-border rounded-xl shadow-sm flex items-center justify-between px-3 md:px-4 shrink-0 transition-all safe-area-pt">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Botão menu mobile maior */}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="md:hidden p-2.5 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          {/* Botão desktop */}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="hidden md:flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          
          {/* Logo - Mais compacto em mobile */}
          <div className="flex items-center gap-1.5 md:gap-1.5">
            <img src={logoImg} alt="IAProgramador" className="w-7 h-7 md:w-6 md:h-6 object-contain" />
            <div className="flex flex-col justify-center gap-0.5 md:gap-1">
              <span className="text-base md:text-sm font-bold text-foreground leading-tight">IAProgramador</span>
              <span className="text-[8px] md:text-[9px] text-primary font-bold uppercase tracking-wider leading-none hidden sm:block">Feito por: O.Scarpeline</span>
            </div>
          </div>
        </div>
        
        {/* Ações - Mais espaçadas em mobile para touch */}
        <div className="flex items-center gap-2 md:gap-3">
          {selectedRepo && (
            <>
              <span className="text-sm text-muted-foreground font-mono flex items-center gap-1">
                <Github className="w-3 h-3" /> {selectedRepo.full_name}
              </span>
              {branches.length > 0 && (
                <select value={branch} onChange={e => handleBranchChange(e.target.value)} className="bg-input border border-border rounded px-2 py-0.5 text-sm text-foreground outline-none">
                  {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              )}
            </>
          )}
          {/* Chat toggle - Abrir/fechar painel do chat */}
          <button
            onClick={() => setBottomOpen(!bottomOpen)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 md:px-2 md:py-1 rounded-xl md:rounded-lg active:scale-95 transition-all ${
              bottomOpen ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">Chat IA</span>
          </button>

          {/* Preview toggle - Touch maior em mobile */}
          <button 
            onClick={() => setShowPreview(!showPreview)} 
            className={`flex items-center gap-1.5 text-sm px-3 py-2 md:px-2 md:py-1 rounded-xl md:rounded-lg active:scale-95 transition-all ${
              showPreview ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Eye className="w-4 h-4 md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>
          
          {/* Componentes de usuário */}
          <div className="flex items-center gap-1 md:gap-2">
            <UserBalanceBar />
            <NotificationBell />
          </div>
          
          {/* Idioma - Escondido em mobile pequeno */}
          <div className="hidden xs:flex items-center gap-1.5 border-r border-border pr-2 md:pr-3 mr-1 ml-1">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent border-none text-xs md:text-sm font-medium text-muted-foreground outline-none cursor-pointer"
            >
              <option value="pt-BR">PT</option>
              <option value="en-US">EN</option>
              <option value="es-ES">ES</option>
            </select>
          </div>
          
          {/* Afiliados - Desktop only */}
          <button 
            onClick={() => navigate("/affiliate")} 
            className="hidden sm:flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" 
            title="Afiliados"
          >
            <Gift className="w-4 h-4" />
          </button>
          
          {/* Email - Desktop only */}
          <span className="hidden md:inline text-sm text-muted-foreground max-w-[120px] truncate">{user?.email}</span>
          
          {/* Logout - Touch maior em mobile */}
          <button 
            onClick={logout} 
            className="p-2.5 md:p-2 rounded-xl md:rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all" 
            title="Sair"
          >
            <LogOut className="w-5 h-5 md:w-4 md:h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden gap-1 md:gap-2">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="absolute inset-0 z-40 md:relative md:inset-auto md:z-0 w-full md:w-64 bg-card border border-border rounded-xl shadow-sm flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-left duration-300">
            <div className="flex border-b border-border bg-muted/40 p-1">
              {([
                { id: "files" as const, icon: FolderGit2, disabled: !selectedRepo },
                { id: "github" as const, icon: Github },
                { id: "search" as const, icon: Search, disabled: !selectedRepo },
              ]).map(tab => (
                <button key={tab.id} onClick={() => !tab.disabled && setSidebarTab(tab.id)}
                  className={`flex-1 flex items-center justify-center py-2 text-sm rounded ${
                    sidebarTab === tab.id ? "bg-background text-foreground shadow-sm" :
                    tab.disabled ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                  }`}><tab.icon className="w-3.5 h-3.5" /></button>
              ))}
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-auto">
              {sidebarTab === "github" && (
                ghView === "connect" ? <GitHubConnect isConnected={false} user={null} onDisconnect={handleGhDisconnect} onConnected={(token, usr) => {
                  setGhToken(token); setGhUser(usr); setGhView("repos");
                }} /> :
                ghView === "repos" ? (
                  <div className="flex flex-col h-full">
                    <GitHubConnect isConnected={true} user={ghUser} onDisconnect={handleGhDisconnect} onCloneUrl={handleCloneUrl} />
                    <div className="border-t border-border flex-1 overflow-hidden">
                      <RepoBrowser token={ghToken!} onSelectRepo={handleSelectRepo} onBack={() => setGhView("connect")} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <GitHubConnect isConnected={true} user={ghUser} onDisconnect={handleGhDisconnect} onCloneUrl={handleCloneUrl} />
                    {selectedRepo && (
                      <div className="p-3 border-t border-border space-y-2">
                        <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-2.5">
                          <p className="text-sm font-semibold text-foreground">{selectedRepo.full_name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <GitBranch className="w-3 h-3" /> {branch}
                          </p>
                        </div>
                        <button onClick={() => { setGhView("repos"); setSelectedRepo(null); setFiles([]); setOpenTabs([]); setActiveTab(null); }}
                          className="w-full text-sm text-primary hover:underline py-1">Trocar repositório</button>
                      </div>
                    )}
                  </div>
                )
              )}
              {sidebarTab === "files" && selectedRepo && (
                loadingTree ? <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> :
                renderFileTree(files)
              )}
              {sidebarTab === "search" && (
                <div className="p-3 flex flex-col gap-2">
                  <input
                    placeholder="Buscar arquivo..."
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => {
                      const q = e.target.value.toLowerCase();
                      if (!q) return;
                      const matches = files.filter(f => f.path.toLowerCase().includes(q));
                      // Render results inline
                      const container = e.target.nextElementSibling as HTMLElement;
                      if (container) {
                        container.innerHTML = matches.slice(0, 20).map(f =>
                          `<div class="px-2 py-1.5 text-xs font-mono text-muted-foreground hover:bg-muted/50 rounded cursor-pointer truncate" data-path="${f.path}">${f.path}</div>`
                        ).join("") || '<div class="text-xs text-muted-foreground px-2 py-2">Nenhum resultado</div>';
                        container.querySelectorAll("[data-path]").forEach(el => {
                          el.addEventListener("click", () => {
                            const node = files.find(f => f.path === el.getAttribute("data-path"));
                            if (node) handleFileSelect(node);
                          });
                        });
                      }
                    }}
                  />
                  <div className="space-y-0.5" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vertical Panel: Chat & Terminal - Design Minimalista */}
        <div className={`flex flex-col bg-slate-950 border border-border/60 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] shrink-0 overflow-hidden z-30 transition-all duration-300 ${bottomOpen ? "w-full md:w-[380px]" : "w-10"}`}>
          <div className="h-9 bg-slate-900/50 border-b border-border/40 flex items-center justify-between px-1 shrink-0">
            {bottomOpen ? (
              <>
                <div className="flex items-center gap-1 overflow-hidden">
                  {([{ id: "chat" as const, icon: MessageSquare, label: "Chat IA" }, { id: "terminal" as const, icon: Terminal, label: "Terminal" }]).map(tab => (
                    <button key={tab.id} onClick={() => setBottomTab(tab.id)} className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${bottomTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      <tab.icon className="w-3 h-3" /> <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setBottomOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-md transition-colors" title="Recolher">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button onClick={() => setBottomOpen(true)} className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title="Abrir Chat">
                <PanelLeftOpen className="w-4 h-4 rotate-180" />
              </button>
            )}
          </div>
          {bottomOpen && (
            <div className="flex-1 overflow-hidden min-h-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
              {bottomTab === "terminal" ? <TerminalPanel messages={termMessages} onCommand={handleTermCommand} /> : (
                <AIChat 
                  messages={chatMessages} 
                  onSend={handleChatSend} 
                  isThinking={isThinking}
                  currentActivity={currentActivity}
                  streamingContent={streamingContent}
                  streamingProvider={streamingProvider}
                  selectedProvider={activeProvider}
                  onProviderChange={setActiveProvider}
                />
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden gap-2">
          {/* Editor Panel - Only visible if there are open tabs */}
          {openTabs.length > 0 && (
            <div className={`flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden ${showPreview ? "hidden lg:flex w-1/2" : "flex-1"}`}>
              <div className="h-10 bg-muted/30 border-b border-border flex items-center overflow-x-auto shrink-0 px-1">
                {loadingFile && <Loader2 className="w-3 h-3 text-primary animate-spin ml-2" />}
                {openTabs.map(tab => (
                  <div key={tab.path} onClick={() => setActiveTab(tab.path)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded-md text-sm cursor-pointer shrink-0 transition-colors ${
                      activeTab === tab.path ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}>
                    <FileCode className="w-3.5 h-3.5" /><span>{tab.name}</span>
                    {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />}
                    <button onClick={e => { e.stopPropagation(); handleCloseTab(tab.path); }} className={`ml-1 ${activeTab === tab.path ? "text-primary-foreground/70 hover:text-white" : "hover:text-destructive"}`}><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {activeTab && activeFile ? (
                  <CodeEditorPanel content={activeFile.content} fileName={activeFile.name} onChange={handleEditorChange} />
                ) : null}
              </div>
              {activeFile?.dirty && selectedRepo && ghToken && (
                <CommitBar token={ghToken} owner={selectedRepo.owner.login} repo={selectedRepo.name} branch={branch}
                  filePath={activeFile.path} content={activeFile.content} fileSha={activeFile.sha} onCommitSuccess={handleCommitSuccess} />
              )}
            </div>
          )}

          {/* Preview Panel - Full width on small screens if editor is hidden */}
          {showPreview && (
            <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col ${openTabs.length > 0 ? "flex-1 lg:w-1/2" : "flex-1"}`}>
              <PreviewPanel 
                url={selectedRepo ? (repoUrls[selectedRepo.full_name] || "") : ""} 
                onUrlChange={handleUrlChange}
                onRefresh={() => {}} 
                fileContent={activeFile?.content} 
                fileName={activeFile?.name} 
              />
            </div>
          )}

          {/* Empty State when both are hidden */}
          {!showPreview && openTabs.length === 0 && (
            <div className="flex-1 bg-card border border-border rounded-xl shadow-sm flex flex-col items-center justify-center">
              <Globe className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground font-medium">Você fechou todas as abas e o preview.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Navegue pelos arquivos ou abra o painel de preview no menu superior.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* 🎨 Mobile Bottom Navigation */}
      <MobileBottomNav
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        bottomOpen={bottomOpen}
        setBottomOpen={setBottomOpen}
        bottomTab={bottomTab}
        setBottomTab={setBottomTab}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        hasOpenTabs={openTabs.length > 0}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openTabs={openTabs.map(t => ({ path: t.path, name: t.name }))}
      />
      
      {/* Mobile padding para safe area */}
      <div className="md:hidden h-[72px] safe-area-pb" />
      </div>
    </div>
  );
};

export default EditorPage;
