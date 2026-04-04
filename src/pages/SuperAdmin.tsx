import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users, DollarSign, Activity, Calculator, Shield, Loader2,
  Plus, RefreshCw, Download, Mail, Phone, Package, Edit2, Trash2, Save, X
} from "lucide-react";

const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 1, output: 4 },
  "google/gemini-2.5-pro": { input: 13, output: 50 },
  "openai/gpt-5": { input: 50, output: 150 },
  "openai/gpt-5-mini": { input: 8, output: 32 },
  "openai/gpt-5-nano": { input: 1, output: 4 },
};

interface AdminUser {
  id: string; email: string; full_name: string | null;
  balance_cents: number; total_spent_cents: number; total_deposited_cents: number;
  affiliate_code: string | null; roles: string[];
}

interface Lead {
  id: string; email: string; whatsapp: string | null;
  status: string; has_paid: boolean; total_paid_cents: number;
  first_login_at: string; last_login_at: string; created_at: string;
}

interface AdminPackage {
  id: string; name: string; description: string | null;
  credits_amount: number; price_brl: number; is_active: boolean;
}

interface WithdrawalRequest {
  id: string; user_id: string; amount_cents: number;
  pix_key: string; status: string; created_at: string;
}

const SuperAdmin = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  // Calculator
  const [calcModel, setCalcModel] = useState("google/gemini-2.5-flash");
  const [calcInputTokens, setCalcInputTokens] = useState("1000");
  const [calcOutputTokens, setCalcOutputTokens] = useState("1000");

  // Package form
  const [editingPkg, setEditingPkg] = useState<AdminPackage | null>(null);
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgCredits, setPkgCredits] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");

  // Notification
  const [notifUserId, setNotifUserId] = useState("all");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");

  // Remarketing filter
  const [leadFilter, setLeadFilter] = useState<"all" | "active" | "inactive" | "never_paid">("all");

  useEffect(() => {
    if (!authLoading && isAdmin) fetchAll();
  }, [authLoading, isAdmin]);

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, balancesRes, rolesRes, leadsRes, pkgsRes, withdrawalsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, affiliate_code"),
      supabase.from("balances").select("user_id, balance_cents, total_spent_cents, total_deposited_cents"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("lead_captures").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("*").order("price_brl"),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
    ]);

    if (profilesRes.data && balancesRes.data) {
      const usersMap: AdminUser[] = (profilesRes.data as any[]).map((p) => {
        const bal = (balancesRes.data as any[]).find((b) => b.user_id === p.id);
        const userRoles = (rolesRes.data as any[] || []).filter((r) => r.user_id === p.id).map((r) => r.role);
        return { ...p, balance_cents: bal?.balance_cents || 0, total_spent_cents: bal?.total_spent_cents || 0, total_deposited_cents: bal?.total_deposited_cents || 0, roles: userRoles };
      });
      setUsers(usersMap);
    }
    if (leadsRes.data) setLeads(leadsRes.data as any[]);
    if (pkgsRes.data) setPackages(pkgsRes.data as any[]);
    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data as any[]);
    setLoading(false);
  };

  const handleAddCredit = async () => {
    if (!creditUserId || !creditAmount) return;
    const cents = Math.round(parseFloat(creditAmount) * 100);
    const { data: bal } = await supabase.from("balances").select("balance_cents, total_deposited_cents").eq("user_id", creditUserId).single();
    if (bal) {
      const current = bal as any;
      await supabase.from("balances").update({
        balance_cents: current.balance_cents + cents,
        total_deposited_cents: current.total_deposited_cents + cents,
        updated_at: new Date().toISOString(),
      } as any).eq("user_id", creditUserId);
      await supabase.from("transactions").insert({
        user_id: creditUserId, type: "deposit", amount_cents: cents,
        description: "Crédito manual (admin)", payment_method: "admin_credit", status: "confirmed",
      } as any);
    }
    toast.success(`R$ ${creditAmount} adicionado!`);
    setCreditAmount(""); setCreditUserId("");
    fetchAll();
  };

  const sendNotification = async () => {
    if (!notifTitle || !notifMessage) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      await fetch(`https://${projectId}.supabase.co/functions/v1/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: notifUserId === "all" ? null : notifUserId, title: notifTitle, message: notifMessage }),
      });
      toast.success("Notificação enviada!");
      setNotifTitle(""); setNotifMessage(""); setNotifUserId("all");
    } catch { toast.error("Erro ao enviar"); }
  };

  // Remarketing download
  const downloadLeads = (filter: string) => {
    let filtered = leads;
    if (filter === "active") filtered = leads.filter(l => l.has_paid);
    else if (filter === "inactive") filtered = leads.filter(l => l.has_paid && l.status === "inactive");
    else if (filter === "never_paid") filtered = leads.filter(l => !l.has_paid);

    const csv = "Email,WhatsApp,Status,Pagou,Total Pago,Primeiro Login,Último Login\n" +
      filtered.map(l => `${l.email},${l.whatsapp || ""},${l.status},${l.has_paid ? "Sim" : "Não"},${(l.total_paid_cents / 100).toFixed(2)},${l.first_login_at},${l.last_login_at}`).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads_${filter}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Package CRUD
  const savePkg = async () => {
    if (!pkgName || !pkgCredits || !pkgPrice) return;
    const credits = parseInt(pkgCredits);
    const price = Math.round(parseFloat(pkgPrice) * 100);
    if (editingPkg) {
      await supabase.from("packages").update({ name: pkgName, description: pkgDesc || null, credits_amount: credits, price_brl: price } as any).eq("id", editingPkg.id);
    } else {
      await supabase.from("packages").insert({ name: pkgName, description: pkgDesc || null, credits_amount: credits, price_brl: price } as any);
    }
    resetPkgForm(); fetchAll();
  };

  const deletePkg = async (id: string) => {
    if (!confirm("Excluir pacote?")) return;
    await supabase.from("packages").delete().eq("id", id);
    fetchAll();
  };

  const editPkg = (pkg: AdminPackage) => {
    setEditingPkg(pkg); setPkgName(pkg.name); setPkgDesc(pkg.description || "");
    setPkgCredits(pkg.credits_amount.toString()); setPkgPrice((pkg.price_brl / 100).toString());
    setShowPkgForm(true);
  };

  const resetPkgForm = () => {
    setEditingPkg(null); setPkgName(""); setPkgDesc(""); setPkgCredits(""); setPkgPrice(""); setShowPkgForm(false);
  };

  // Withdrawal processing
  const processWithdrawal = async (id: string, action: "approved" | "rejected") => {
    await supabase.from("withdrawal_requests").update({ status: action, processed_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(`Saque ${action === "approved" ? "aprovado" : "rejeitado"}`);
    fetchAll();
  };

  // Calculator
  const calcCost = () => {
    const prices = TOKEN_PRICES[calcModel] || { input: 1, output: 4 };
    const inputCost = (parseInt(calcInputTokens) / 1000) * prices.input;
    const outputCost = (parseInt(calcOutputTokens) / 1000) * prices.output;
    return { inputCost, outputCost, total: inputCost + outputCost };
  };

  const totalRevenue = users.reduce((s, u) => s + u.total_deposited_cents, 0);
  const totalSpent = users.reduce((s, u) => s + u.total_spent_cents, 0);
  const totalBalance = users.reduce((s, u) => s + u.balance_cents, 0);

  const filteredLeads = leadFilter === "all" ? leads :
    leadFilter === "active" ? leads.filter(l => l.has_paid) :
    leadFilter === "inactive" ? leads.filter(l => l.has_paid && l.status === "inactive") :
    leads.filter(l => !l.has_paid);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><Card><CardContent className="p-8 text-center"><Shield className="w-12 h-12 text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold">Acesso negado</h2></CardContent></Card></div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Super Admin</h1>
            <p className="text-sm text-muted-foreground">Painel de administração CodPilot</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}><X className="w-4 h-4" /> Voltar</Button>
            <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><Users className="w-8 h-8 text-primary" /><p className="text-2xl font-bold mt-2">{users.length}</p><p className="text-xs text-muted-foreground">Usuários</p></CardContent></Card>
          <Card><CardContent className="p-4"><DollarSign className="w-8 h-8 text-[hsl(var(--success))]" /><p className="text-2xl font-bold mt-2">R$ {(totalRevenue / 100).toFixed(2)}</p><p className="text-xs text-muted-foreground">Receita</p></CardContent></Card>
          <Card><CardContent className="p-4"><Activity className="w-8 h-8 text-[hsl(var(--warning))]" /><p className="text-2xl font-bold mt-2">R$ {(totalSpent / 100).toFixed(2)}</p><p className="text-xs text-muted-foreground">Gasto tokens</p></CardContent></Card>
          <Card><CardContent className="p-4"><DollarSign className="w-8 h-8 text-primary" /><p className="text-2xl font-bold mt-2">R$ {(totalBalance / 100).toFixed(2)}</p><p className="text-xs text-muted-foreground">Saldo ativo</p></CardContent></Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="remarketing">Remarketing</TabsTrigger>
            <TabsTrigger value="packages">Pacotes</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques</TabsTrigger>
            <TabsTrigger value="calculator">Calculadora</TabsTrigger>
            <TabsTrigger value="credits">Créditos</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
          </TabsList>

          {/* Users */}
          <TabsContent value="users">
            <Card>
              <CardHeader><CardTitle>Todos os Usuários</CardTitle></CardHeader>
              <CardContent>
                {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead><TableHead>Nome</TableHead><TableHead>Saldo</TableHead>
                        <TableHead>Gasto</TableHead><TableHead>Depositado</TableHead><TableHead>Roles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono text-xs">{u.email}</TableCell>
                          <TableCell>{u.full_name || "—"}</TableCell>
                          <TableCell className="text-[hsl(var(--success))]">R$ {(u.balance_cents / 100).toFixed(2)}</TableCell>
                          <TableCell className="text-destructive">R$ {(u.total_spent_cents / 100).toFixed(2)}</TableCell>
                          <TableCell>R$ {(u.total_deposited_cents / 100).toFixed(2)}</TableCell>
                          <TableCell>{u.roles.map(r => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Remarketing */}
          <TabsContent value="remarketing">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Remarketing & Leads</CardTitle>
                    <CardDescription>Captura de emails e WhatsApp para automação</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadLeads(leadFilter)}>
                      <Download className="w-4 h-4" /> Baixar CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {(["all", "active", "inactive", "never_paid"] as const).map(f => (
                    <Button key={f} size="sm" variant={leadFilter === f ? "default" : "outline"} onClick={() => setLeadFilter(f)}>
                      {f === "all" ? "Todos" : f === "active" ? "Ativos (pagaram)" : f === "inactive" ? "Inativos" : "Nunca pagou"}
                      <Badge variant="secondary" className="ml-1">
                        {(f === "all" ? leads : f === "active" ? leads.filter(l => l.has_paid) : f === "inactive" ? leads.filter(l => l.has_paid && l.status === "inactive") : leads.filter(l => !l.has_paid)).length}
                      </Badge>
                    </Button>
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead><TableHead>WhatsApp</TableHead><TableHead>Status</TableHead>
                      <TableHead>Pagou</TableHead><TableHead>Total Pago</TableHead><TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.email}</TableCell>
                        <TableCell className="text-xs">{l.whatsapp || "—"}</TableCell>
                        <TableCell><Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                        <TableCell>{l.has_paid ? <span className="text-[hsl(var(--success))]">Sim</span> : <span className="text-destructive">Não</span>}</TableCell>
                        <TableCell>R$ {(l.total_paid_cents / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Packages */}
          <TabsContent value="packages">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{editingPkg ? "Editar Pacote" : "Gerenciar Pacotes"}</CardTitle>
                    {!showPkgForm && <Button size="sm" onClick={() => setShowPkgForm(true)}><Plus className="w-4 h-4" /> Novo</Button>}
                  </div>
                </CardHeader>
                {showPkgForm && (
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nome</Label><Input value={pkgName} onChange={e => setPkgName(e.target.value)} placeholder="Pacote Starter" /></div>
                      <div><Label>Créditos</Label><Input type="number" value={pkgCredits} onChange={e => setPkgCredits(e.target.value)} placeholder="1000" /></div>
                    </div>
                    <div><Label>Descrição</Label><Textarea value={pkgDesc} onChange={e => setPkgDesc(e.target.value)} /></div>
                    <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} placeholder="19.90" /></div>
                    <div className="flex gap-2">
                      <Button onClick={savePkg}><Save className="w-4 h-4" /> {editingPkg ? "Atualizar" : "Criar"}</Button>
                      <Button variant="outline" onClick={resetPkgForm}>Cancelar</Button>
                    </div>
                  </CardContent>
                )}
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.map(pkg => (
                  <Card key={pkg.id} className={pkg.is_active ? "" : "opacity-50"}>
                    <CardHeader>
                      <div className="flex justify-between"><Package className="w-6 h-6 text-primary" /><Badge>{pkg.is_active ? "Ativo" : "Inativo"}</Badge></div>
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">R$ {(pkg.price_brl / 100).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{pkg.credits_amount.toLocaleString()} créditos</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => editPkg(pkg)}><Edit2 className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => deletePkg(pkg.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Withdrawals */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader><CardTitle>Solicitações de Saque</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead><TableHead>Valor</TableHead><TableHead>PIX</TableHead>
                      <TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map(w => {
                      const usr = users.find(u => u.id === w.user_id);
                      return (
                        <TableRow key={w.id}>
                          <TableCell className="text-xs">{usr?.email || w.user_id.slice(0, 8)}</TableCell>
                          <TableCell>R$ {(w.amount_cents / 100).toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs">{w.pix_key}</TableCell>
                          <TableCell><Badge variant={w.status === "pending" ? "default" : "secondary"}>{w.status}</Badge></TableCell>
                          <TableCell className="text-xs">{new Date(w.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            {w.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" onClick={() => processWithdrawal(w.id, "approved")}>Aprovar</Button>
                                <Button size="sm" variant="destructive" onClick={() => processWithdrawal(w.id, "rejected")}>Rejeitar</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calculator */}
          <TabsContent value="calculator">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" /> Calculadora de Tokens</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Modelo</Label>
                    <select value={calcModel} onChange={e => setCalcModel(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground">
                      {Object.keys(TOKEN_PRICES).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div><Label>Tokens entrada</Label><Input type="number" value={calcInputTokens} onChange={e => setCalcInputTokens(e.target.value)} /></div>
                  <div><Label>Tokens saída</Label><Input type="number" value={calcOutputTokens} onChange={e => setCalcOutputTokens(e.target.value)} /></div>
                </div>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo entrada:</span><span>R$ {(calcCost().inputCost / 100).toFixed(4)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo saída:</span><span>R$ {(calcCost().outputCost / 100).toFixed(4)}</span></div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2"><span>Total:</span><span className="text-primary">R$ {(calcCost().total / 100).toFixed(4)}</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credits */}
          <TabsContent value="credits">
            <Card>
              <CardHeader><CardTitle>Adicionar Créditos</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Usuário</Label>
                    <select value={creditUserId} onChange={e => setCreditUserId(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground">
                      <option value="">Selecione...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.email} (R$ {(u.balance_cents / 100).toFixed(2)})</option>)}
                    </select>
                  </div>
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="10.00" /></div>
                  <div className="flex items-end"><Button onClick={handleAddCredit} disabled={!creditUserId || !creditAmount}><Plus className="w-4 h-4" /> Adicionar</Button></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader><CardTitle>Enviar Notificação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Destinatário</Label>
                  <select value={notifUserId} onChange={e => setNotifUserId(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground">
                    <option value="all">Todos os usuários</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                  </select>
                </div>
                <div><Label>Título</Label><Input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} /></div>
                <div><Label>Mensagem</Label><Textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} /></div>
                <Button onClick={sendNotification} disabled={!notifTitle || !notifMessage}><Mail className="w-4 h-4" /> Enviar</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdmin;
