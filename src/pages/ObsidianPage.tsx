import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/lib/github";
import {
  buildGraph,
  clearVaultConfig,
  getVaultConfig,
  listNotes,
  listVaultRepos,
  readNote,
  saveNote,
  setVaultConfig,
  type GraphData,
  type VaultConfig,
  type VaultNote,
} from "@/lib/obsidian";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Brain,
  FileText,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Unlink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";

export default function ObsidianPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<VaultConfig | null>(null);
  const [repos, setRepos] = useState<{ owner: string; name: string; default_branch: string }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [activeNote, setActiveNote] = useState<VaultNote | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("notes");

  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphProgress, setGraphProgress] = useState({ loaded: 0, total: 0 });

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const graphContainer = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ w: 800, h: 500 });

  // init
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    const t = getToken();
    setToken(t);
    setConfig(getVaultConfig());
  }, [user, navigate]);

  useEffect(() => {
    if (!graphContainer.current) return;
    const ro = new ResizeObserver(() => {
      const r = graphContainer.current!.getBoundingClientRect();
      setGraphSize({ w: r.width, h: Math.max(400, r.height) });
    });
    ro.observe(graphContainer.current);
    return () => ro.disconnect();
  }, [tab]);

  // load notes when config ready
  useEffect(() => {
    if (token && config) refreshNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, config]);

  async function loadRepos() {
    if (!token) {
      toast.error("Conecte sua conta GitHub primeiro (vá em 'Editor' e conecte).");
      return;
    }
    setLoadingRepos(true);
    try {
      const list = await listVaultRepos(token);
      setRepos(
        list.map((r) => ({
          owner: r.owner.login,
          name: r.name,
          default_branch: r.default_branch,
        })),
      );
    } catch (e) {
      toast.error("Falha ao listar repositórios: " + (e as Error).message);
    } finally {
      setLoadingRepos(false);
    }
  }

  function confirmVault() {
    const r = repos.find((x) => `${x.owner}/${x.name}` === selectedRepo);
    if (!r) return;
    const cfg = { owner: r.owner, repo: r.name, branch: r.default_branch };
    setVaultConfig(cfg);
    setConfig(cfg);
    toast.success(`Vault conectado: ${cfg.owner}/${cfg.repo}`);
  }

  function disconnect() {
    clearVaultConfig();
    setConfig(null);
    setNotes([]);
    setActiveNote(null);
    setContent("");
    setGraph({ nodes: [], links: [] });
  }

  async function refreshNotes() {
    if (!token || !config) return;
    setLoadingNotes(true);
    try {
      const list = await listNotes(token, config);
      setNotes(list);
    } catch (e) {
      toast.error("Erro ao listar notas: " + (e as Error).message);
    } finally {
      setLoadingNotes(false);
    }
  }

  async function openNote(n: VaultNote) {
    if (!token || !config) return;
    setActiveNote(n);
    try {
      const { content } = await readNote(token, config, n.path);
      setContent(content);
    } catch (e) {
      toast.error("Erro ao abrir: " + (e as Error).message);
    }
  }

  async function newNote() {
    const name = prompt("Nome da nota (sem .md):");
    if (!name) return;
    const path = `${name}.md`;
    setActiveNote({ path, name });
    setContent(`# ${name}\n\n`);
    setTab("notes");
  }

  async function save() {
    if (!token || !config || !activeNote) return;
    setSaving(true);
    try {
      await saveNote(token, config, activeNote.path, content, `Edit ${activeNote.name}`);
      toast.success("Nota salva no GitHub");
      refreshNotes();
    } catch (e) {
      toast.error("Erro ao salvar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function generateGraph() {
    if (!token || !config) return;
    setGraphLoading(true);
    setGraphProgress({ loaded: 0, total: notes.length });
    try {
      const g = await buildGraph(token, config, notes, (loaded, total) =>
        setGraphProgress({ loaded, total }),
      );
      setGraph(g);
    } catch (e) {
      toast.error("Erro ao gerar grafo: " + (e as Error).message);
    } finally {
      setGraphLoading(false);
    }
  }

  async function aiCreate() {
    if (!token || !config || !aiPrompt.trim()) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente que cria notas no estilo Obsidian/Zettelkasten. Responda APENAS com JSON válido no formato: {\"title\":\"...\",\"content\":\"# Título\\n\\nConteúdo em markdown com [[links]] para conceitos relacionados e #tags.\"}. Use links [[wiki]] generosamente para conectar ideias.",
            },
            { role: "user", content: aiPrompt },
          ],
          model: "google/gemini-2.5-flash",
        },
      });
      if (error) throw error;
      const text: string = data?.content || data?.message || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("IA não retornou JSON válido");
      const parsed = JSON.parse(jsonMatch[0]);
      const title = (parsed.title || "Nova Nota").replace(/[\\/:*?"<>|]/g, "-");
      const path = `${title}.md`;
      await saveNote(token, config, path, parsed.content, `IA: ${title}`);
      toast.success(`Nota "${title}" criada!`);
      setAiPrompt("");
      refreshNotes();
      setActiveNote({ path, name: title });
      setContent(parsed.content);
      setTab("notes");
    } catch (e) {
      toast.error("Erro IA: " + (e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  const stats = useMemo(
    () => ({
      notes: graph.nodes.filter((n) => n.path).length,
      orphans: graph.nodes.filter((n) => !n.path).length,
      links: graph.links.length,
    }),
    [graph],
  );

  // ----- RENDER -----
  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader onBack={() => navigate("/")} />
        <div className="max-w-2xl mx-auto p-8 text-center">
          <Brain className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-2">Conecte o GitHub primeiro</h1>
          <p className="text-muted-foreground mb-6">
            Seu vault do Obsidian fica num repositório GitHub. Conecte sua conta no Editor para começar.
          </p>
          <Button onClick={() => navigate("/")}>Ir para o Editor</Button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader onBack={() => navigate("/")} />
        <div className="max-w-2xl mx-auto p-8">
          <div className="text-center mb-8">
            <Brain className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-2xl font-bold mb-2">Conectar Vault Obsidian</h1>
            <p className="text-muted-foreground">
              Escolha um repositório GitHub dedicado às suas notas. Pode ser um vault que você já
              sincroniza com o plugin <strong>Obsidian Git</strong> ou um repo novo.
            </p>
          </div>
          <Card className="p-6 space-y-4">
            <Button onClick={loadRepos} disabled={loadingRepos} className="w-full">
              {loadingRepos ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Carregar meus repositórios
            </Button>
            {repos.length > 0 && (
              <>
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o repositório do vault" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((r) => (
                      <SelectItem key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                        {r.owner}/{r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={confirmVault} disabled={!selectedRepo} className="w-full">
                  Usar este repo como Vault
                </Button>
              </>
            )}
            <div className="text-xs text-muted-foreground border-t border-border pt-4 mt-4">
              💡 Dica: no Obsidian instale o plugin <strong>"Obsidian Git"</strong> e aponte para o
              mesmo repo — assim suas notas sincronizam automaticamente entre o desktop/celular e
              esta interface web.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader onBack={() => navigate("/")} repoName={`${config.owner}/${config.repo}`} />

      <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-2 shrink-0">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Cérebro Obsidian</span>
        <span className="text-xs text-muted-foreground ml-2">{notes.length} notas</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={refreshNotes} disabled={loadingNotes}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loadingNotes ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          <Unlink className="h-3 w-3 mr-1" />
          Trocar vault
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 self-start">
          <TabsTrigger value="notes">
            <FileText className="h-4 w-4 mr-1" /> Notas
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-4 w-4 mr-1" /> Criar com IA
          </TabsTrigger>
          <TabsTrigger value="graph">
            <Network className="h-4 w-4 mr-1" /> Grafo
          </TabsTrigger>
        </TabsList>

        {/* NOTAS */}
        <TabsContent value="notes" className="flex-1 flex gap-3 p-4 m-0">
          <Card className="w-64 p-3 overflow-auto shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">NOTAS</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={newNote}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {loadingNotes ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">Vault vazio. Crie sua primeira nota!</p>
            ) : (
              <ul className="space-y-1">
                {notes.map((n) => (
                  <li key={n.path}>
                    <button
                      onClick={() => openNote(n)}
                      className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-accent truncate ${
                        activeNote?.path === n.path ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      {n.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex-1 p-3 flex flex-col">
            {activeNote ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={activeNote.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setActiveNote({ name: newName, path: `${newName}.md` });
                    }}
                    className="font-medium"
                  />
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 font-mono text-sm resize-none"
                  placeholder="# Título&#10;&#10;Use [[wiki-links]] para conectar notas e #tags para classificar."
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Selecione uma nota ou crie uma nova
              </div>
            )}
          </Card>
        </TabsContent>

        {/* IA */}
        <TabsContent value="ai" className="p-4 m-0">
          <Card className="max-w-2xl mx-auto p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Gerar nota com IA</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Descreva o tema. A IA cria uma nota markdown com links{" "}
              <code className="text-xs bg-muted px-1 rounded">[[wiki]]</code> conectando ideias e
              comita direto no seu vault GitHub.
            </p>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: 'Crie uma nota sobre Zettelkasten conectada com Segundo Cérebro e PKM'"
              rows={4}
              className="mb-3"
            />
            <Button onClick={aiCreate} disabled={aiBusy || !aiPrompt.trim()} className="w-full">
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar e commitar
            </Button>
          </Card>
        </TabsContent>

        {/* GRAFO */}
        <TabsContent value="graph" className="flex-1 flex flex-col p-4 m-0">
          <div className="flex items-center gap-2 mb-3">
            <Button onClick={generateGraph} disabled={graphLoading || notes.length === 0}>
              {graphLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Lendo {graphProgress.loaded}/{graphProgress.total}
                </>
              ) : (
                <>
                  <Network className="h-4 w-4 mr-2" />
                  Gerar / Atualizar grafo
                </>
              )}
            </Button>
            {graph.nodes.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {stats.notes} notas · {stats.orphans} referências órfãs · {stats.links} conexões
              </span>
            )}
          </div>
          <Card className="flex-1 overflow-hidden" ref={graphContainer}>
            {graph.nodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Clique em "Gerar grafo" para visualizar a rede de neurônios do seu vault.
              </div>
            ) : (
              <ForceGraph2D
                graphData={graph}
                width={graphSize.w}
                height={graphSize.h}
                nodeLabel={(n: any) => n.label}
                nodeRelSize={4}
                nodeVal={(n: any) => n.val}
                nodeColor={(n: any) => (n.path ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))")}
                linkColor={() => "hsla(var(--foreground) / 0.15)"}
                linkDirectionalParticles={1}
                linkDirectionalParticleSpeed={0.005}
                cooldownTicks={120}
                onNodeClick={(n: any) => {
                  if (n.path) {
                    const note = notes.find((x) => x.path === n.path);
                    if (note) {
                      openNote(note);
                      setTab("notes");
                    }
                  }
                }}
              />
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
