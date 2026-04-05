import { useState, useCallback, useEffect } from "react";
import {
  PanelLeftClose, PanelLeftOpen, FolderGit2, Terminal, MessageSquare,
  Eye, X, FileCode, Search, GitBranch, Github, Loader2, Save,
  Wallet, Gift, LogOut, Code2, Globe
} from "lucide-react";
import logoImg from "@/assets/logo-iaprogramador.png";
import FileTree from "@/components/FileTree";
import CodeEditorPanel from "@/components/CodeEditorPanel";
import TerminalPanel from "@/components/TerminalPanel";
import AIChat from "@/components/AIChat";
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
type ChatMsg = { role: "user" | "ai" | "system"; content: string; timestamp: Date };

const EditorPage = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const [bottomOpen, setBottomOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);

  const [termMessages, setTermMessages] = useState<TermMsg[]>([
    { type: "system", text: "IAProgramador Terminal v2.0 — Conecte seu GitHub para começar.", timestamp: new Date() },
  ]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: "system", content: "Bem-vindo ao IAProgramador! 🚀\n\nSou um agente autônomo. Você não precisa usar comandos específicos.\n\nSimplesmente converse comigo e diga o que você deseja mudar, corrigir ou criar, e eu mapearei o repositório e farei o trabalho pra você! Se apenas tiver uma dúvida, pode me perguntar livremente.", timestamp: new Date() },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [searchParams] = useSearchParams();

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
  const handleFileModification = async (message: string, model?: string) => {
    if (!selectedRepo) {
      setChatMessages(p => [...p, { role: "ai", content: "❌ Nenhum repositório selecionado.", timestamp: new Date() }]);
      return;
    }

    try {
      const modifier = new AIFileModifier(ghToken!, selectedRepo, branch);
      
      const addProgress = (msg: string) => {
        setChatMessages(p => [...p, { role: "system", content: msg, timestamp: new Date() }]);
      };

      const result = await modifier.processCommand(
        message, 
        model || "google/gemini-2.5-flash", 
        addProgress,
        chatMessages.filter(m => m.role !== "system")
      );
      
      if (result.modifications.length === 0) {
        setChatMessages(p => [...p, { role: "ai", content: result.message, timestamp: new Date() }]);
        return;
      }

      addProgress(result.message + "\n\n⚡ **Aplicando alterações no GitHub...**");

      const executionResult = await modifier.executeModifications(result.modifications);
      setChatMessages(p => [...p, { role: "ai", content: executionResult, timestamp: new Date() }]);

      // Refresh file tree
      setLoadingTree(true);
      try {
        const tree = await getRepoTree(ghToken!, selectedRepo.owner.login, selectedRepo.name, branch);
        setFiles(tree);
        
        // Refresh any open tabs that were modified
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
      setChatMessages(p => [...p, { role: "ai", content: `❌ Erro: ${errMsg}`, timestamp: new Date() }]);
    }
  };
  const handleChatSend = useCallback(async (message: string, model?: string) => {
    setChatMessages(p => [...p, { role: "user", content: message, timestamp: new Date() }]);
    setIsThinking(true);
    
    try {
      if (ghToken && selectedRepo) {
        // Se há um repositório conectado, o Agente cuida de TODAS as interações via o AIFileModifier
        await handleFileModification(message, model);
        setIsThinking(false);
        return;
      }

      // Fallback: se não tiver repositório conectado, age como chat simples
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { supabase } = await import("@/integrations/supabase/client");
      const session = (await supabase.auth.getSession()).data.session;
      const messages = chatMessages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));
      messages.push({ role: "user", content: message });

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
          model: model || "google/gemini-3-flash-preview",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setChatMessages(p => [...p, { role: "ai", content: errData.error || `Erro: ${res.status}`, timestamp: new Date() }]);
        setIsThinking(false);
        return;
      }

      const data = await res.json();
      const aiContent = data.content || "Sem resposta do modelo.";
      const usageInfo = data.usage
        ? `\n\n${formatUsageText(data.usage.input_tokens, data.usage.output_tokens, data.usage.cost_cents)}`
        : "";
      setChatMessages(p => [...p, { role: "ai", content: aiContent + usageInfo, timestamp: new Date() }]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setChatMessages(p => [...p, { role: "ai", content: `Erro: ${errMsg}`, timestamp: new Date() }]);
    }
    setIsThinking(false);
  }, [selectedRepo, branch, activeFile, chatMessages, ghToken]);

  const renderFileTree = (nodes: FileNode[]) => (
    <div className="text-xs">
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
    <div className="h-screen flex flex-col overflow-hidden bg-background p-2 gap-2 text-foreground font-sans">
      <AuthErrorHandler />
      <UserBalanceBar />

      {/* Title bar */}
      <div className="h-12 bg-card border border-border rounded-xl shadow-sm flex items-center justify-between px-4 shrink-0 transition-all">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-muted-foreground hover:text-foreground">
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1.5">
            <img src={logoImg} alt="IAProgramador" className="w-6 h-6 object-contain" />
            <span className="text-xs font-bold text-foreground">IAProgramador</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedRepo && (
            <>
              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                <Github className="w-3 h-3" /> {selectedRepo.full_name}
              </span>
              {branches.length > 0 && (
                <select value={branch} onChange={e => handleBranchChange(e.target.value)} className="bg-input border border-border rounded px-2 py-0.5 text-xs text-foreground outline-none">
                  {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              )}
            </>
          )}
          <button onClick={() => setShowPreview(!showPreview)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${showPreview ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <NotificationBell />
          
          <div className="flex items-center gap-1.5 border-r border-border pr-3 mr-1">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent border-none text-xs text-muted-foreground outline-none cursor-pointer"
            >
              <option value="pt-BR">PT</option>
              <option value="en-US">EN</option>
              <option value="es-ES">ES</option>
            </select>
          </div>
          <button onClick={() => navigate("/wallet")} className="text-muted-foreground hover:text-foreground" title="Carteira">
            <Wallet className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/affiliate")} className="text-muted-foreground hover:text-foreground" title="Afiliados">
            <Gift className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <button onClick={logout} className="text-muted-foreground hover:text-foreground" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden gap-2">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-64 bg-card border border-border rounded-xl shadow-sm flex flex-col shrink-0 overflow-hidden">
            <div className="flex border-b border-border bg-muted/40">
              {([
                { id: "files" as const, icon: FolderGit2, disabled: !selectedRepo },
                { id: "github" as const, icon: Github },
                { id: "search" as const, icon: Search, disabled: !selectedRepo },
              ]).map(tab => (
                <button key={tab.id} onClick={() => !tab.disabled && setSidebarTab(tab.id)}
                  className={`flex-1 flex items-center justify-center py-2.5 text-xs ${
                    sidebarTab === tab.id ? "text-foreground border-b-2 border-primary" :
                    tab.disabled ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                  }`}><tab.icon className="w-3.5 h-3.5" /></button>
              ))}
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
                          <p className="text-xs font-semibold text-foreground">{selectedRepo.full_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <GitBranch className="w-3 h-3" /> {branch}
                          </p>
                        </div>
                        <button onClick={() => { setGhView("repos"); setSelectedRepo(null); setFiles([]); setOpenTabs([]); setActiveTab(null); }}
                          className="w-full text-xs text-primary hover:underline py-1">Trocar repositório</button>
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
                <div className="p-3"><input placeholder="Buscar..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none" /></div>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden gap-2">
          <div className="flex-1 flex overflow-hidden gap-2">
            <div className={`flex-1 flex flex-col overflow-hidden bg-card border border-border rounded-xl shadow-sm ${showPreview ? "w-1/2" : ""}`}>
              <div className="h-10 bg-muted/30 border-b border-border flex items-center overflow-x-auto shrink-0 px-1">
                {loadingFile && <Loader2 className="w-3 h-3 text-primary animate-spin ml-2" />}
                {openTabs.map(tab => (
                  <div key={tab.path} onClick={() => setActiveTab(tab.path)}
                    className={`flex items-center gap-1.5 px-3 h-full text-xs cursor-pointer border-r border-border shrink-0 ${
                      activeTab === tab.path ? "bg-background text-foreground border-t-2 border-t-primary" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <FileCode className="w-3 h-3 text-primary" /><span>{tab.name}</span>
                    {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    <button onClick={e => { e.stopPropagation(); handleCloseTab(tab.path); }} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {activeTab && activeFile ? (
                  <CodeEditorPanel content={activeFile.content} fileName={activeFile.name} onChange={handleEditorChange} />
                ) : (
                  <div className="flex items-center justify-center h-full bg-[hsl(var(--editor-bg))]">
                    <div className="text-center">
                      {selectedRepo ? (
                        <><FolderGit2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Selecione um arquivo</p></>
                      ) : (
                        <><Code2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm font-semibold text-muted-foreground">IAProgramador</p><p className="text-xs text-muted-foreground/60 mt-1">Conecte seu GitHub para começar</p></>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {activeFile?.dirty && selectedRepo && ghToken && (
                <CommitBar token={ghToken} owner={selectedRepo.owner.login} repo={selectedRepo.name} branch={branch}
                  filePath={activeFile.path} content={activeFile.content} fileSha={activeFile.sha} onCommitSuccess={handleCommitSuccess} />
              )}
            </div>
            {showPreview && (
              <div className="w-1/2 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                <PreviewPanel url="" onRefresh={() => {}} fileContent={activeFile?.content} fileName={activeFile?.name} />
              </div>
            )}
          </div>
          {bottomOpen && (
            <div className="h-64 bg-card border border-border rounded-xl shadow-sm flex flex-col shrink-0 overflow-hidden">
              <div className="h-9 bg-muted/30 border-b border-border flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-1">
                  {([{ id: "terminal" as const, icon: Terminal, label: "Terminal" }, { id: "chat" as const, icon: MessageSquare, label: "Chat IA" }]).map(tab => (
                    <button key={tab.id} onClick={() => setBottomTab(tab.id)} className={`flex items-center gap-1 px-3 py-1 text-xs ${bottomTab === tab.id ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"}`}>
                      <tab.icon className="w-3 h-3" /> {tab.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setBottomOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                {bottomTab === "terminal" ? <TerminalPanel messages={termMessages} onCommand={handleTermCommand} /> : <AIChat messages={chatMessages} onSend={handleChatSend} isThinking={isThinking} />}
              </div>
            </div>
          )}
          <div className="h-8 bg-card border border-border rounded-lg shadow-sm flex items-center justify-between px-4 text-xs text-muted-foreground shrink-0 mt-auto">
            <div className="flex items-center gap-4">
              {!bottomOpen && (
                <>
                  <button onClick={() => { setBottomOpen(true); setBottomTab("terminal"); }} className="hover:text-foreground flex items-center gap-1"><Terminal className="w-3 h-3" /> Terminal</button>
                  <button onClick={() => { setBottomOpen(true); setBottomTab("chat"); }} className="hover:text-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Chat</button>
                </>
              )}
              {ghUser && <span className="text-[hsl(var(--success))]">● @{ghUser.login}</span>}
            </div>
            <div className="flex items-center gap-3">
              {activeFile?.dirty && <span className="flex items-center gap-1"><Save className="w-3 h-3" /> Modificado</span>}
              {activeFile?.name && <span>{activeFile.name}</span>}
              <span>UTF-8</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
