import { useState, useCallback, useEffect } from "react";
import {
  PanelLeftClose, PanelLeftOpen, FolderGit2, Terminal, MessageSquare,
  Eye, X, FileCode, Search, GitBranch, Github, Loader2, Save,
  Wallet, Shield, Gift, LogOut,
} from "lucide-react";
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

type Tab = { path: string; name: string; content: string; sha?: string; dirty?: boolean };
type TermMsg = { type: "input" | "output" | "error" | "system" | "success"; text: string; timestamp: Date };
type ChatMsg = { role: "user" | "ai" | "system"; content: string; timestamp: Date };

const EditorPage = () => {
  const { user, isAdmin, logout } = useAuth();
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
    { type: "system", text: "CodPilot Terminal v2.0 — Conecte seu GitHub para começar.", timestamp: new Date() },
  ]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: "system", content: "Bem-vindo ao CodPilot! Conecte seu GitHub pelo painel lateral.", timestamp: new Date() },
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
      else if (cmd === "help") setTermMessages(p => [...p, { type: "output", text: "Comandos: help, clear, status, whoami", timestamp: new Date() }]);
      else if (cmd === "whoami") setTermMessages(p => [...p, { type: "output", text: ghUser ? `@${ghUser.login}` : "Não conectado", timestamp: new Date() }]);
      else setTermMessages(p => [...p, { type: "output", text: `Comando não reconhecido. Digite "help"`, timestamp: new Date() }]);
    }, 200);
  }, [ghUser]);

  const activeFile = openTabs.find(t => t.path === activeTab);

  const handleChatSend = useCallback(async (message: string) => {
    setChatMessages(p => [...p, { role: "user", content: message, timestamp: new Date() }]);
    setIsThinking(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, fileContent: activeFile?.content, fileName: activeFile?.name, repoName: selectedRepo?.full_name, branch }),
      });
      const data = await res.json();
      setChatMessages(p => [...p, { role: "ai", content: data.reply || data.error || "Erro", timestamp: new Date() }]);
    } catch (err: any) {
      setChatMessages(p => [...p, { role: "ai", content: `Erro: ${err.message}`, timestamp: new Date() }]);
    }
    setIsThinking(false);
  }, [selectedRepo, branch, activeFile]);

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
    <div className="h-screen flex flex-col overflow-hidden">
      <AuthErrorHandler />
      <UserBalanceBar />

      {/* Title bar */}
      <div className="h-10 bg-card border-b border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-muted-foreground hover:text-foreground">
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">CodPilot</span>
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
          {isAdmin && (
            <button onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground" title="Super Admin">
              <Shield className="w-4 h-4" />
            </button>
          )}
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-64 bg-card border-r border-border flex flex-col shrink-0">
            <div className="flex border-b border-border">
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
                ghView === "connect" ? <GitHubConnect isConnected={false} user={null} onDisconnect={handleGhDisconnect} /> :
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
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 flex flex-col overflow-hidden ${showPreview ? "w-1/2" : ""}`}>
              <div className="h-9 bg-muted border-b border-border flex items-center overflow-x-auto shrink-0">
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
                        <><Github className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Conecte seu GitHub</p></>
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
              <div className="w-1/2 border-l border-border">
                <PreviewPanel url="" onRefresh={() => {}} fileContent={activeFile?.content} fileName={activeFile?.name} />
              </div>
            )}
          </div>
          {bottomOpen && (
            <div className="h-56 border-t border-border flex flex-col shrink-0">
              <div className="h-8 bg-muted flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center">
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
          <div className="h-6 bg-card border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-3">
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
