import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Shield, Rocket, Network, Activity, Search, ShieldAlert, Cpu } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppHeader from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ForceGraph2D from "react-force-graph-2d";

export default function AutonomousDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar projetos: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const graphData = {
    nodes: [
      { id: "Core", group: 1, val: 20 },
      { id: "Auth", group: 2, val: 15 },
      { id: "Database", group: 2, val: 15 },
      { id: "Frontend", group: 3, val: 12 },
      { id: "Backend", group: 3, val: 12 },
      { id: "Security", group: 4, val: 18 },
    ],
    links: [
      { source: "Core", target: "Auth" },
      { source: "Core", target: "Database" },
      { source: "Auth", target: "Security" },
      { source: "Backend", target: "Database" },
      { source: "Frontend", target: "Backend" },
    ]
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200">
      <AppHeader onBack={() => navigate("/")} />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Cpu className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                AI AUTONOMOUS ENGINE
              </h1>
              <p className="text-slate-500 text-sm">Cérebro Semântico & Segurança Ativa</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
              <Search className="h-4 w-4 mr-2" />
              Busca Semântica
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              <Activity className="h-4 w-4 mr-2" />
              Nova Análise
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#121216] border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Security Score</span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-mono">94<span className="text-sm text-slate-600">/100</span></div>
            <Progress value={94} className="h-1 bg-slate-800" />
          </Card>
          <Card className="bg-[#121216] border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Logic Memory</span>
              <Brain className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-3xl font-mono">2.4k<span className="text-sm text-slate-600"> nodes</span></div>
            <Progress value={65} className="h-1 bg-slate-800" />
          </Card>
          <Card className="bg-[#121216] border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Auto Patches</span>
              <Rocket className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-3xl font-mono">12<span className="text-sm text-slate-600"> applied</span></div>
            <Progress value={80} className="h-1 bg-slate-800" />
          </Card>
          <Card className="bg-[#121216] border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Active Threats</span>
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-3xl font-mono text-red-400">03<span className="text-sm text-slate-600"> detected</span></div>
            <Progress value={20} className="h-1 bg-slate-800" />
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-[#121216] border-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="neural">Mapa Neural</TabsTrigger>
            <TabsTrigger value="security">Segurança Ativa</TabsTrigger>
            <TabsTrigger value="history">Histórico Evolutivo</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-[#121216] border-slate-800 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Projetos sob Supervisão Autônoma
              </h3>
              <div className="space-y-4">
                {projects.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    Nenhum projeto em análise ativa.
                  </div>
                ) : (
                  projects.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-[#1a1a20] rounded-lg border border-slate-800 hover:border-primary/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                          <Brain className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.repository_url}</div>
                        </div>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="text-right">
                          <div className="text-xs text-slate-500 uppercase tracking-widest">Security</div>
                          <div className={`text-sm font-mono ${p.security_score > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                            {p.security_score}%
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">Ver Detalhes</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="bg-[#121216] border-slate-800 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Atividade Recente da IA
              </h3>
              <div className="space-y-4">
                {[
                  { t: "Patch Aplicado", d: "Correção de SQL Injection no módulo de usuários.", time: "12m atrás", icon: Shield },
                  { t: "Análise Completa", d: "Mapeamento semântico do repositório 'core-api'.", time: "1h atrás", icon: Brain },
                  { t: "Ameaça Bloqueada", d: "Tentativa de RCE detectada em ambiente sandbox.", time: "3h atrás", icon: ShieldAlert },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="mt-1"><item.icon className="h-4 w-4 text-primary" /></div>
                    <div>
                      <div className="font-medium">{item.t}</div>
                      <div className="text-slate-500 text-xs">{item.d}</div>
                      <div className="text-slate-600 text-[10px] mt-1 uppercase">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="neural" className="h-[600px]">
            <Card className="h-full bg-[#121216] border-slate-800 overflow-hidden relative">
              <div className="absolute top-4 left-4 z-10 bg-[#0a0a0c]/80 p-3 rounded-lg border border-slate-800 backdrop-blur-sm">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
                  Visualização do Cérebro Semântico
                </h3>
                <p className="text-[10px] text-slate-500">Mapeamento de relações e dependências inteligentes</p>
              </div>
              <ForceGraph2D
                graphData={graphData}
                backgroundColor="#0a0a0c"
                nodeLabel="id"
                nodeColor={n => n.group === 1 ? "#3b82f6" : n.group === 2 ? "#8b5cf6" : "#4b5563"}
                linkColor={() => "#1e293b"}
                width={1200}
                height={600}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
