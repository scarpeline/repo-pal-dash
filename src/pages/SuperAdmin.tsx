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
  Plus, RefreshCw, Download, Mail, Package, Edit2, Trash2, Save, X, Cpu, TrendingUp, HandCoins, MessageSquare, Ban, CheckCircle, Settings, ExternalLink
} from "lucide-react";

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
  checkout_url?: string | null;
  asaas_payment_link_id?: string | null;
  stripe_price_id?: string | null;
}

interface WithdrawalRequest {
  id: string; user_id: string; amount_cents: number;
  pix_key: string; status: string; created_at: string;
}

interface ModelPricing {
  id: string; model_id: string; model_label: string;
  api_cost_input_per_million: number; api_cost_output_per_million: number;
  resale_price_input_per_million: number; resale_price_output_per_million: number;
  is_active: boolean;
}

const SuperAdmin = () => {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const backend = supabase as any;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricing[]>([]);
  const [editingPricing, setEditingPricing] = useState<Record<string, Partial<ModelPricing>>>({});
  const [loading, setLoading] = useState(true);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  // Calculator
  const [calcModel, setCalcModel] = useState("");
  const [calcInputTokens, setCalcInputTokens] = useState("1000");
  const [calcOutputTokens, setCalcOutputTokens] = useState("1000");

  // Package form
  const [editingPkg, setEditingPkg] = useState<AdminPackage | null>(null);
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgCredits, setPkgCredits] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  // Package calculator auto-calculation
  const [pkgModelId, setPkgModelId] = useState("");
  const [pkgInputTokens, setPkgInputTokens] = useState("1000");
  const [pkgOutputTokens, setPkgOutputTokens] = useState("1000");
  const [pkgMarginPercent, setPkgMarginPercent] = useState("50");
  const [pkgCheckoutUrl, setPkgCheckoutUrl] = useState("");
  const [pkgAsaasLinkId, setPkgAsaasLinkId] = useState("");
  const [pkgStripePriceId, setPkgStripePriceId] = useState("");
  const [primaryGateway, setPrimaryGateway] = useState<"asaas" | "stripe">("asaas");

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
    const [profilesRes, balancesRes, rolesRes, leadsRes, pkgsRes, withdrawalsRes, pricingRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, affiliate_code"),
      supabase.from("balances").select("user_id, balance_cents, total_spent_cents, total_deposited_cents"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("lead_captures").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("*").order("price_brl"),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("ai_model_pricing").select("*").order("model_label"),
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
    
    // Fetch app settings
    const { data: settings } = await backend.from("app_settings").select("*").eq("key", "primary_gateway").single();
    if (settings) setPrimaryGateway(settings.value as any);

    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data as any[]);
    if (pricingRes.data) {
      setModelPricing(pricingRes.data as any[]);
      if (!calcModel && (pricingRes.data as any[]).length > 0) setCalcModel((pricingRes.data as any[])[0].model_id);
      if (!pkgModelId && (pricingRes.data as any[]).length > 0) setPkgModelId((pricingRes.data as any[])[0].model_id);
    }
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

  const toggleUserBlock = async (userId: string, roles: string[]) => {
    const isBlocked = roles.includes("blocked");
    if (isBlocked) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "user" as any);
      toast.success("Usuário desbloqueado com sucesso!");
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "user" } as any);
      toast.success("Usuário bloqueado do acesso à IA!");
    }
    fetchAll();
  };

  const updateWithdrawalStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("withdrawal_requests")
      .update({ status: newStatus as any })
      .eq("id", id);

    if (error) toast.error("Erro ao atualizar status");
    else toast.success(`Pedido marcado como ${newStatus}`);
    fetchAll();
  };

  const quickDonate = async (userId: string) => {
    const amtStr = prompt("Quantos Reais (R$) adicionar ao saldo deste usuário?");
    if (!amtStr) return;
    const cents = Math.round(parseFloat(amtStr) * 100);
    if (isNaN(cents) || cents <= 0) return toast.error("Valor inválido");
    
    const { data: bal } = await supabase.from("balances").select("balance_cents, total_deposited_cents").eq("user_id", userId).single();
    if (bal) {
      const current = bal as any;
      await supabase.from("balances").update({
        balance_cents: current.balance_cents + cents,
        total_deposited_cents: current.total_deposited_cents + cents,
        updated_at: new Date().toISOString(),
      } as any).eq("user_id", userId);
      await supabase.from("transactions").insert({
        user_id: userId, type: "deposit", amount_cents: cents,
        description: "Bônus manual (Super Admin)", payment_method: "admin_credit", status: "confirmed",
      } as any);
      toast.success(`R$ ${amtStr} doados com sucesso!`);
      fetchAll();
    }
  };

  const quickMessage = (userId: string) => {
    setNotifUserId(userId);
    const notifTab = document.querySelector<HTMLElement>("[data-state='inactive'][value='notifications']");
    if (notifTab) notifTab.click();
    toast.info("Aba de mensagens aberta para o usuário selecionado. Desça a tela para enviar.");
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

  const downloadLeads = (filter: string) => {
    let filtered = leads;
    if (filter === "active") filtered = leads.filter(l => l.has_paid);
    else if (filter === "inactive") filtered = leads.filter(l => l.has_paid && l.status === "inactive");
    else if (filter === "never_paid") filtered = leads.filter(l => !l.has_paid);
    const csv = "Email,WhatsApp,Status,Pagou,Total Pago,Primeiro Login,Último Login\n" +
      filtered.map(l => `${l.email},${l.whatsapp || ""},${l.status},${l.has_paid ? "Sim" : "Não"},${(l.total_paid_cents / 100).toFixed(2)},${l.first_login_at},${l.last_login_at}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads_${filter}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Package CRUD
  const createDefaultPackages = async () => {
    setLoading(true);
    const defaultPrices = [10, 15, 20, 25, 30, 50, 70, 100, 150, 200];
    const newPackages = defaultPrices.map(price => {
      const tokens = calculateTokensFromPrice(price, pkgModelId || "google/gemini-3-flash-preview", 50);
      return {
        name: price <= 30 ? "Pacote Professional" : price <= 70 ? "Pacote Business" : "Pacote Enterprise",
        description: `Pacote com ${tokens.totalTokens.toLocaleString('pt-BR')} tokens para acelerar seus projetos IA.`,
        price_brl: price * 100,
        credits_amount: tokens.totalTokens,
        is_active: true
      };
    });

    try {
      await supabase.from("packages").insert(newPackages as any[]);
      toast.success("Todos os 10 Pacotes Padrão foram gerados com sucesso!");
      fetchAll();
    } catch (e) {
      toast.error("Erro ao gerar pacotes");
    } finally {
      setLoading(false);
    }
  };

  const savePkg = async () => {
    if (!validatePackage()) return;
    
    const credits = parseInt(pkgCredits);
    const price = Math.round(parseFloat(pkgPrice) * 100);
    
    try {
      if (editingPkg) {
        await supabase.from("packages").update({ 
          name: pkgName, 
          description: pkgDesc || null, 
          credits_amount: credits, 
          price_brl: price,
          checkout_url: pkgCheckoutUrl,
          asaas_payment_link_id: pkgAsaasLinkId,
          stripe_price_id: pkgStripePriceId
        } as any).eq("id", editingPkg.id);
        toast.success("Pacote atualizado com sucesso!");
      } else {
        await supabase.from("packages").insert({ 
          name: pkgName, 
          description: pkgDesc || null, 
          credits_amount: credits, 
          price_brl: price,
          checkout_url: pkgCheckoutUrl,
          asaas_payment_link_id: pkgAsaasLinkId,
          stripe_price_id: pkgStripePriceId
        } as any);
        toast.success("Pacote criado com sucesso!");
      }
      resetPkgForm(); 
      fetchAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar pacote: " + message);
    }
  };

  const deletePkg = async (id: string) => { if (!confirm("Excluir pacote?")) return; await supabase.from("packages").delete().eq("id", id); fetchAll(); };
  const editPkg = (pkg: AdminPackage) => {
    setEditingPkg(pkg);
    setPkgName(pkg.name);
    setPkgDesc(pkg.description || "");
    setPkgCredits(pkg.credits_amount.toString());
    setPkgPrice((pkg.price_brl / 100).toString());
    setPkgCheckoutUrl(pkg.checkout_url || "");
    setPkgAsaasLinkId(pkg.asaas_payment_link_id || "");
    setPkgStripePriceId(pkg.stripe_price_id || "");
    setShowPkgForm(true);
  };

  const resetPkgForm = () => {
    setEditingPkg(null);
    setPkgName("");
    setPkgDesc("");
    setPkgCredits("");
    setPkgPrice("");
    setPkgModelId(modelPricing[0]?.model_id || "");
    setPkgInputTokens("1000");
    setPkgOutputTokens("1000");
    setPkgMarginPercent("50");
    setPkgCheckoutUrl("");
    setPkgAsaasLinkId("");
    setPkgStripePriceId("");
    setShowPkgForm(false);
  };

  const processWithdrawal = async (id: string, action: "approved" | "rejected") => {
    await supabase.from("withdrawal_requests").update({ status: action, processed_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(`Saque ${action === "approved" ? "aprovado" : "rejeitado"}`); fetchAll();
  };

  // Pricing management
  const updatePricingField = (id: string, field: string, value: string) => {
    setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], [field]: parseInt(value) || 0 } }));
  };

  const savePricing = async (mp: ModelPricing) => {
    const edits = editingPricing[mp.id];
    if (!edits) return;
    const updated = { ...mp, ...edits, updated_at: new Date().toISOString() };
    await supabase.from("ai_model_pricing").update({
      api_cost_input_per_million: updated.api_cost_input_per_million,
      api_cost_output_per_million: updated.api_cost_output_per_million,
      resale_price_input_per_million: updated.resale_price_input_per_million,
      resale_price_output_per_million: updated.resale_price_output_per_million,
      is_active: updated.is_active,
    } as any).eq("id", mp.id);
    setEditingPricing(prev => { const n = { ...prev }; delete n[mp.id]; return n; });
    toast.success(`Preços de ${mp.model_label} atualizados!`);
    fetchAll();
  };

  // Calculator using real pricing
  const calcCost = () => {
    const mp = modelPricing.find(m => m.model_id === calcModel);
    if (!mp) return { apiInput: 0, apiOutput: 0, resaleInput: 0, resaleOutput: 0, totalApi: 0, totalResale: 0, profit: 0 };
    const inTk = parseInt(calcInputTokens) || 0;
    const outTk = parseInt(calcOutputTokens) || 0;
    const apiInput = (inTk / 1_000_000) * mp.api_cost_input_per_million;
    const apiOutput = (outTk / 1_000_000) * mp.api_cost_output_per_million;
    const resaleInput = (inTk / 1_000_000) * mp.resale_price_input_per_million;
    const resaleOutput = (outTk / 1_000_000) * mp.resale_price_output_per_million;
    const totalApi = apiInput + apiOutput;
    const totalResale = resaleInput + resaleOutput;
    return { apiInput, apiOutput, resaleInput, resaleOutput, totalApi, totalResale, profit: totalResale - totalApi };
  };

  // Package calculator auto-calculation
  const calculatePackageValues = () => {
    const mp = modelPricing.find(m => m.model_id === pkgModelId);
    if (!mp) return { credits: 0, costPrice: 0, salePrice: 0, profit: 0, margin: 0 };
    
    const inTokens = parseInt(pkgInputTokens) || 0;
    const outTokens = parseInt(pkgOutputTokens) || 0;
    const marginPct = parseFloat(pkgMarginPercent) || 50;
    
    // Custo real da API (em centavos)
    const apiInputCost = (inTokens / 1_000_000) * mp.api_cost_input_per_million;
    const apiOutputCost = (outTokens / 1_000_000) * mp.api_cost_output_per_million;
    const totalApiCost = apiInputCost + apiOutputCost;
    
    // Preço de revenda base (em centavos)
    const resaleInput = (inTokens / 1_000_000) * mp.resale_price_input_per_million;
    const resaleOutput = (outTokens / 1_000_000) * mp.resale_price_output_per_million;
    const baseResalePrice = resaleInput + resaleOutput;
    
    // Aplicar margem de lucro desejada sobre o preço de revenda
    const marginMultiplier = 1 + (marginPct / 100);
    const finalPrice = Math.round(baseResalePrice * marginMultiplier);
    
    // Créditos = quantidade total de tokens (input + output)
    const totalCredits = inTokens + outTokens;
    
    const profit = finalPrice - totalApiCost;
    const actualMargin = totalApiCost > 0 ? ((finalPrice - totalApiCost) / totalApiCost) * 100 : 0;
    
    return {
      credits: totalCredits,
      costPrice: totalApiCost,
      salePrice: finalPrice,
      profit: profit,
      margin: actualMargin
    };
  };

  const syncAsaasProducts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("asaas-payment?action=sync-products", {
        body: { action: "sync-products" },
      });
      if (error) throw error;
      
      
      const results = data.sync_results || [];
      const created = results.filter((r: any) => r.status === "created").length;
      const errors = results.filter((r: any) => r.status === "error").length;
      
      if (errors > 0) {
        toast.warning(`${created} pacotes sincronizados, ${errors} falharam.`);
      } else {
        toast.success(`${created || results.length} pacotes sincronizados com sucesso!`);
      }
      fetchAll();
    } catch (err: any) {
      toast.error("Erro na sincronização: " + err.message);
    }
  };

  // Auto-fill package values when calculator changes
  const applyCalculatedValues = () => {
    const calc = calculatePackageValues();
    setPkgCredits(calc.credits.toString());
    setPkgPrice((calc.salePrice / 100).toFixed(2));
  };

  // Calculate tokens based on price (reverse calculation)
  const calculateTokensFromPrice = (price: number, modelId: string, marginPercent: number = 50) => {
    const mp = modelPricing.find(m => m.model_id === modelId);
    if (!mp || price <= 0) return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    // Converter preço para centavos
    const priceInCents = Math.round(price * 100);
    
    // Calcular preço base sem margem
    const marginMultiplier = 1 + (marginPercent / 100);
    const basePrice = priceInCents / marginMultiplier;
    
    // Preço por milhão de tokens (média de input e output)
    const resalePricePerMillion = (mp.resale_price_input_per_million + mp.resale_price_output_per_million) / 2;
    
    // Calcular quantidade total de tokens
    const totalTokens = Math.round((basePrice / resalePricePerMillion) * 1_000_000);
    
    // Dividir em 70% input e 30% output (proporção comum)
    const inputTokens = Math.round(totalTokens * 0.7);
    const outputTokens = Math.round(totalTokens * 0.3);
    
    return {
      inputTokens: Math.max(1000, inputTokens), // mínimo 1000 tokens
      outputTokens: Math.max(1000, outputTokens), // mínimo 1000 tokens
      totalTokens: inputTokens + outputTokens
    };
  };

  // Auto-fill tokens when price changes
  const handlePriceChange = (price: string) => {
    setPkgPrice(price);
    
    const priceNum = parseFloat(price);
    if (!isNaN(priceNum) && priceNum > 0 && pkgModelId) {
      const tokens = calculateTokensFromPrice(priceNum, pkgModelId, parseFloat(pkgMarginPercent) || 50);
      setPkgInputTokens(tokens.inputTokens.toString());
      setPkgOutputTokens(tokens.outputTokens.toString());
      setPkgCredits(tokens.totalTokens.toString());
      
      // Auto-fill package name based on price range
      if (!pkgName || pkgName === "") {
        let suggestedName = "";
        if (priceNum <= 10) suggestedName = "Pacote Starter";
        else if (priceNum <= 30) suggestedName = "Pacote Professional";
        else if (priceNum <= 60) suggestedName = "Pacote Business";
        else suggestedName = "Pacote Enterprise";
        
        setPkgName(suggestedName);
      }
      
      // Auto-fill description
      if (!pkgDesc || pkgDesc === "") {
        const totalTokens = tokens.totalTokens.toLocaleString('pt-BR');
        setPkgDesc(`Pacote com ${totalTokens} tokens (${tokens.inputTokens.toLocaleString('pt-BR')} input + ${tokens.outputTokens.toLocaleString('pt-BR')} output) para uso nos modelos IA mais avançados.`);
      }
    }
  };

  // Validate package before saving
  const validatePackage = () => {
    if (!pkgName.trim()) {
      toast.error("Nome do pacote é obrigatório");
      return false;
    }
    if (!pkgDesc.trim()) {
      toast.error("Descrição do pacote é obrigatória");
      return false;
    }
    if (!pkgCredits || parseInt(pkgCredits) <= 0) {
      toast.error("Quantidade de créditos deve ser maior que zero");
      return false;
    }
    if (!pkgPrice || parseFloat(pkgPrice) <= 0) {
      toast.error("Preço deve ser maior que zero");
      return false;
    }
    return true;
  };

  const totalRevenue = users.reduce((s, u) => s + u.total_deposited_cents, 0);
  const totalSpent = users.reduce((s, u) => s + u.total_spent_cents, 0);
  const totalBalance = users.reduce((s, u) => s + u.balance_cents, 0);

  const filteredLeads = leadFilter === "all" ? leads :
    leadFilter === "active" ? leads.filter(l => l.has_paid) :
    leadFilter === "inactive" ? leads.filter(l => l.has_paid && l.status === "inactive") :
    leads.filter(l => !l.has_paid);

  const hasAccess = isAdmin;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!hasAccess) return <div className="min-h-screen flex items-center justify-center"><Card><CardContent className="p-8 text-center"><Shield className="w-12 h-12 text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold">Acesso negado</h2><p className="text-sm text-muted-foreground mt-2">Email: {user?.email || "não logado"}</p></CardContent></Card></div>;

  const getVal = (mp: ModelPricing, field: keyof ModelPricing): string | number => {
    const v = editingPricing[mp.id]?.[field] !== undefined ? editingPricing[mp.id][field] : mp[field];
    return typeof v === "boolean" ? (v ? 1 : 0) : (v as string | number);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Super Admin</h1>
            <p className="text-sm text-muted-foreground">Painel de administração IAProgramador</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}><X className="w-4 h-4 mr-1" /> Voltar</Button>
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
            <TabsTrigger value="pricing">💰 Preços IA</TabsTrigger>
            <TabsTrigger value="remarketing">Remarketing</TabsTrigger>
            <TabsTrigger value="packages">Pacotes</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques</TabsTrigger>
            <TabsTrigger value="calculator">Calculadora</TabsTrigger>
            <TabsTrigger value="credits">Créditos</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="w-4 h-4" /> Configurações</TabsTrigger>
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
                        <TableHead>Email</TableHead><TableHead>Saldo</TableHead>
                        <TableHead>Consumo</TableHead><TableHead>Custo API</TableHead><TableHead>Depositado</TableHead><TableHead>Lucro Aprox.</TableHead>
                        <TableHead>Roles</TableHead><TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => {
                        const isBlocked = u.roles.includes("blocked");
                        // Lucro aproximado de 50% em cima do que ele consumiu (total_spent_cents reflete custo de revenda)
                        const profitCents = u.total_spent_cents * 0.5;
                        return (
                        <TableRow key={u.id} className={isBlocked ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs">{u.email}</TableCell>
                          <TableCell className="text-[hsl(var(--success))] font-bold py-3">R$ {(u.balance_cents / 100).toFixed(2)}</TableCell>
                          <TableCell className="font-medium">R$ {(u.total_spent_cents / 100).toFixed(2)}</TableCell>
                          <TableCell className="text-destructive">R$ {(u.total_spent_cents * 0.5 / 100).toFixed(2)}</TableCell>
                          <TableCell className="font-medium">R$ {(u.total_deposited_cents / 100).toFixed(2)}</TableCell>
                          <TableCell className="text-primary font-bold">R$ {(profitCents / 100).toFixed(2)}</TableCell>
                          <TableCell>{u.roles.map(r => <Badge key={r} variant={r === "blocked" ? "destructive" : "secondary"} className="mr-1">{r}</Badge>)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100" onClick={() => quickMessage(u.id)} title="Enviar Mensagem">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:text-green-700 hover:bg-green-100" onClick={() => quickDonate(u.id)} title="Doar Crédito">
                                <HandCoins className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className={`h-8 w-8 ${isBlocked ? 'text-green-600 hover:bg-green-100' : 'text-red-500 hover:bg-red-100'}`} onClick={() => toggleUserBlock(u.id, u.roles)} title={isBlocked ? "Desbloquear" : "Bloquear IA"}>
                                {isBlocked ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HandCoins className="w-5 h-5" /> Solicitações de Saque (Afiliados)</CardTitle>
                <CardDescription>Aprove ou rejeite pedidos de saque. A transferência real deve ser feita manualmente ou via API antes de marcar como pago.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Chave PIX</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma solicitação pendente</TableCell></TableRow>
                      ) : withdrawals.map((w) => {
                        const u = users.find(usr => usr.id === w.user_id);
                        return (
                          <TableRow key={w.id}>
                            <TableCell>
                              <div className="font-medium text-xs">{u?.email || "ID: " + w.user_id.slice(0,8)}</div>
                            </TableCell>
                            <TableCell className="font-bold text-[hsl(var(--success))]">R$ {(w.amount_cents / 100).toFixed(2)}</TableCell>
                            <TableCell>
                              <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{w.pix_key}</code>
                            </TableCell>
                            <TableCell>
                              <Badge variant={w.status === "paid" ? "default" : w.status === "pending" ? "secondary" : "destructive"}>
                                {w.status === "paid" ? "Pago" : w.status === "pending" ? "Pendente" : "Rejeitado"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              {w.status === "pending" && (
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200" onClick={() => updateWithdrawalStatus(w.id, 'paid')}>Pagar</Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => updateWithdrawalStatus(w.id, 'rejected')}>Rejeitar</Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" /> Custos e Preços de Revenda por Modelo</CardTitle>
                  <CardDescription>Configure o custo real da API e o preço de revenda (por milhão de tokens, em centavos R$). A margem é calculada automaticamente.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modelo</TableHead>
                          <TableHead className="text-center">Custo API<br/><span className="text-[10px] text-muted-foreground">Input / 1M</span></TableHead>
                          <TableHead className="text-center">Custo API<br/><span className="text-[10px] text-muted-foreground">Output / 1M</span></TableHead>
                          <TableHead className="text-center">Preço Revenda<br/><span className="text-[10px] text-muted-foreground">Input / 1M</span></TableHead>
                          <TableHead className="text-center">Preço Revenda<br/><span className="text-[10px] text-muted-foreground">Output / 1M</span></TableHead>
                          <TableHead className="text-center">Margem</TableHead>
                          <TableHead className="text-center">Ativo</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modelPricing.map(mp => {
                          const apiIn = Number(getVal(mp, "api_cost_input_per_million"));
                          const apiOut = Number(getVal(mp, "api_cost_output_per_million"));
                          const resIn = Number(getVal(mp, "resale_price_input_per_million"));
                          const resOut = Number(getVal(mp, "resale_price_output_per_million"));
                          const totalApi = apiIn + apiOut;
                          const totalResale = resIn + resOut;
                          const marginPct = totalApi > 0 ? ((totalResale - totalApi) / totalApi * 100).toFixed(0) : "∞";
                          const hasEdits = !!editingPricing[mp.id];

                          return (
                            <TableRow key={mp.id}>
                              <TableCell>
                                <div className="font-medium text-sm">{mp.model_label}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{mp.model_id}</div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" className="w-20 h-7 text-xs text-center mx-auto"
                                  value={getVal(mp, "api_cost_input_per_million")}
                                  onChange={e => updatePricingField(mp.id, "api_cost_input_per_million", e.target.value)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" className="w-20 h-7 text-xs text-center mx-auto"
                                  value={getVal(mp, "api_cost_output_per_million")}
                                  onChange={e => updatePricingField(mp.id, "api_cost_output_per_million", e.target.value)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" className="w-20 h-7 text-xs text-center mx-auto bg-primary/5 border-primary/30"
                                  value={getVal(mp, "resale_price_input_per_million")}
                                  onChange={e => updatePricingField(mp.id, "resale_price_input_per_million", e.target.value)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" className="w-20 h-7 text-xs text-center mx-auto bg-primary/5 border-primary/30"
                                  value={getVal(mp, "resale_price_output_per_million")}
                                  onChange={e => updatePricingField(mp.id, "resale_price_output_per_million", e.target.value)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={Number(marginPct) > 100 ? "default" : "secondary"} className="text-xs">
                                  <TrendingUp className="w-3 h-3 mr-1" />{marginPct}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <button
                                  onClick={() => updatePricingField(mp.id, "is_active", mp.is_active ? "0" : "1")}
                                  className={`w-8 h-4 rounded-full transition-colors ${mp.is_active ? "bg-[hsl(var(--success))]" : "bg-muted"}`}
                                >
                                  <div className={`w-3 h-3 bg-background rounded-full transition-transform ${mp.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                              </TableCell>
                              <TableCell>
                                {hasEdits && (
                                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => savePricing(mp)}>
                                    <Save className="w-3 h-3 mr-1" /> Salvar
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Summary card */}
              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Como funciona:</strong> O custo API é o que você paga para o provedor. O preço de revenda é o que o usuário paga.
                    Antes de cada chamada, o sistema verifica o saldo do usuário. Se insuficiente, bloqueia e avisa.
                    Após a resposta, deduz o custo real (baseado em tokens consumidos × preço de revenda) do saldo.
                  </p>
                </CardContent>
              </Card>
            </div>
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
                  <Button variant="outline" size="sm" onClick={() => downloadLeads(leadFilter)}><Download className="w-4 h-4" /> Baixar CSV</Button>
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={syncAsaasProducts} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Sincronizar Asaas
                      </Button>
                      {!showPkgForm && (
                        <>
                          {packages.length === 0 && (
                            <Button size="sm" variant="outline" onClick={createDefaultPackages}><RefreshCw className="w-4 h-4 mr-2" /> Gerar Pacotes Padrão</Button>
                          )}
                          <Button size="sm" onClick={() => setShowPkgForm(true)}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {showPkgForm && (
                  <CardContent className="space-y-4">
                    {/* Calculator Section */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 space-y-3 border border-blue-200">
                      <p className="text-sm font-semibold flex items-center gap-2 text-blue-800">
                        <Calculator className="w-4 h-4 text-blue-600" />
                        Calculadora Inteligente de Pacotes
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Automático</span>
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Modelo IA</Label>
                          <select 
                            value={pkgModelId} 
                            onChange={e => setPkgModelId(e.target.value)} 
                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {modelPricing.map(m => <option key={m.model_id} value={m.model_id}>{m.model_label}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Tokens Entrada</Label>
                          <Input type="number" value={pkgInputTokens} onChange={e => setPkgInputTokens(e.target.value)} className="h-8 border-gray-300" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Tokens Saída</Label>
                          <Input type="number" value={pkgOutputTokens} onChange={e => setPkgOutputTokens(e.target.value)} className="h-8 border-gray-300" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Margem Lucro (%)</Label>
                          <Input type="number" value={pkgMarginPercent} onChange={e => setPkgMarginPercent(e.target.value)} className="h-8 border-gray-300" />
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div className="text-center">
                            <div className="text-gray-500 mb-1">Custo API</div>
                            <div className="font-bold text-red-600">R$ {(calculatePackageValues().costPrice / 100).toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500 mb-1">Preço Final</div>
                            <div className="font-bold text-blue-600">R$ {(calculatePackageValues().salePrice / 100).toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500 mb-1">Lucro</div>
                            <div className="font-bold text-green-600">R$ {(calculatePackageValues().profit / 100).toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500 mb-1">Margem Real</div>
                            <div className="font-bold text-purple-600">{calculatePackageValues().margin.toFixed(0)}%</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-600">
                            <strong>Total de Tokens:</strong> {parseInt(pkgInputTokens) + parseInt(pkgOutputTokens).toLocaleString('pt-BR')}
                          </div>
                          <Button size="sm" onClick={applyCalculatedValues} className="h-7 text-xs bg-blue-600 hover:bg-blue-700">
                            <TrendingUp className="w-3 h-3 mr-1" /> Aplicar Valores
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Manual Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nome</Label><Input value={pkgName} onChange={e => setPkgName(e.target.value)} placeholder="Pacote Starter" /></div>
                      <div><Label>Créditos</Label><Input type="number" value={pkgCredits} onChange={e => setPkgCredits(e.target.value)} placeholder="2000" /></div>
                    </div>
                    <div><Label>Descrição</Label><Textarea value={pkgDesc} onChange={e => setPkgDesc(e.target.value)} placeholder="Pacote com 2000 tokens para uso nos modelos IA..." /></div>
                    <div><Label>Preço (R$) <span className="text-xs text-muted-foreground ml-1">(auto-calcula tokens)</span></Label><Input type="number" step="0.01" value={pkgPrice} onChange={e => handlePriceChange(e.target.value)} placeholder="29.90" /></div>
                    
                    <div className="border-t pt-4 mt-2 space-y-4">
                      <p className="text-sm font-semibold flex items-center gap-2 text-blue-600">
                        <ExternalLink className="w-4 h-4" /> Configurações de Gateway (Links Externos)
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">URL de Checkout (Asaas/Stripe)</Label>
                          <Input value={pkgCheckoutUrl} onChange={e => setPkgCheckoutUrl(e.target.value)} placeholder="https://www.asaas.com/c/..." className="h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">ID do Link Asaas</Label>
                          <Input value={pkgAsaasLinkId} onChange={e => setPkgAsaasLinkId(e.target.value)} placeholder="link_..." className="h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">ID do Preço Stripe</Label>
                          <Input value={pkgStripePriceId} onChange={e => setPkgStripePriceId(e.target.value)} placeholder="price_..." className="h-8 text-xs" />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        * Se a URL de Checkout estiver preenchida, o sistema redirecionará o usuário diretamente para ela.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" /> Calculadora de Rentabilidade</CardTitle>
                <CardDescription>Simule custos e receita com base nos preços configurados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Modelo</Label>
                    <select value={calcModel} onChange={e => setCalcModel(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground">
                      {modelPricing.map(m => <option key={m.model_id} value={m.model_id}>{m.model_label}</option>)}
                    </select>
                  </div>
                  <div><Label>Tokens entrada</Label><Input type="number" value={calcInputTokens} onChange={e => setCalcInputTokens(e.target.value)} /></div>
                  <div><Label>Tokens saída</Label><Input type="number" value={calcOutputTokens} onChange={e => setCalcOutputTokens(e.target.value)} /></div>
                </div>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">CUSTO API (SEU CUSTO)</p>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Input:</span><span>R$ {(calcCost().apiInput / 100).toFixed(6)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Output:</span><span>R$ {(calcCost().apiOutput / 100).toFixed(6)}</span></div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2"><span>Total API:</span><span className="text-destructive">R$ {(calcCost().totalApi / 100).toFixed(6)}</span></div>
                </div>
                <div className="bg-primary/5 rounded-lg p-4 space-y-2 border border-primary/20">
                  <p className="text-xs font-semibold text-primary mb-2">PREÇO REVENDA (COBRA DO USUÁRIO)</p>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Input:</span><span>R$ {(calcCost().resaleInput / 100).toFixed(6)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Output:</span><span>R$ {(calcCost().resaleOutput / 100).toFixed(6)}</span></div>
                  <div className="flex justify-between text-sm font-bold border-t border-primary/20 pt-2"><span>Total Revenda:</span><span className="text-primary">R$ {(calcCost().totalResale / 100).toFixed(6)}</span></div>
                </div>
                <div className="bg-[hsl(var(--success))]/10 rounded-lg p-4 border border-[hsl(var(--success))]/30">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[hsl(var(--success))]" /> Lucro por req:</span>
                    <span className="text-[hsl(var(--success))]">R$ {(calcCost().profit / 100).toFixed(6)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Margem: {calcCost().totalApi > 0 ? ((calcCost().profit / calcCost().totalApi) * 100).toFixed(0) : "∞"}%
                    {" | "}Para 1.000 reqs = R$ {(calcCost().profit * 1000 / 100).toFixed(2)} de lucro
                  </p>
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
          {/* Configurações Globais */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Configurações Globais do Sistema
                </CardTitle>
                <CardDescription>Gerencie o gateway de pagamento e outras preferências globais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Gateway de Pagamento Primário</h3>
                  <p className="text-sm text-muted-foreground">
                    Selecione qual gateway será usado por padrão para processar novos pagamentos.
                  </p>
                  <div className="flex gap-4">
                    <Button 
                      variant={primaryGateway === "asaas" ? "default" : "outline"}
                      onClick={async () => {
                        setPrimaryGateway("asaas");
                        await backend.from("app_settings").upsert({ key: "primary_gateway", value: "asaas" as any }, { onConflict: "key" });
                        toast.success("Gateway primário alterado para Asaas");
                      }}
                      className="flex-1 h-24 flex flex-col gap-2 transition-all hover:scale-[1.02]"
                    >
                      <Badge variant="outline" className={primaryGateway === "asaas" ? "bg-white text-primary" : "opacity-50"}>
                        {primaryGateway === "asaas" ? "Ativo" : "Alternativo"}
                      </Badge>
                      <span className="font-bold">Asaas (Brasil/PIX)</span>
                    </Button>
                    <Button 
                      variant={primaryGateway === "stripe" ? "default" : "outline"}
                      onClick={async () => {
                        setPrimaryGateway("stripe");
                        await backend.from("app_settings").upsert({ key: "primary_gateway", value: "stripe" as any }, { onConflict: "key" });
                        toast.success("Gateway primário alterado para Stripe");
                      }}
                      className="flex-1 h-24 flex flex-col gap-2 transition-all hover:scale-[1.02]"
                    >
                      <Badge variant="outline" className={primaryGateway === "stripe" ? "bg-white text-primary" : "opacity-50"}>
                        {primaryGateway === "stripe" ? "Ativo" : "Contingência"}
                      </Badge>
                      <span className="font-bold">Stripe (Internacional/Cartão)</span>
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 text-destructive">Zona de Perigo</h3>
                  <p className="text-xs text-muted-foreground mb-4">Ações irreversíveis que impactam dados sensíveis.</p>
                  <Button variant="destructive" onClick={() => { if(confirm("Deseja realmente limpar todos os logs de transação?")) toast.error("Função não implementada por segurança."); }}>
                    Limpar Histórico de Transações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdmin;
