import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, DollarSign, Activity, Calculator, Shield, Loader2,
  Plus, RefreshCw, Download, Mail, Package, Edit2, Trash2, Save, X, Cpu, TrendingUp, HandCoins, MessageSquare, Ban, CheckCircle, Settings, ExternalLink, LogOut, Crown
} from "lucide-react";
import { formatCreditsAsBRL } from "@/utils/credits";
import SuperAdminVIPTab from "@/components/SuperAdminVIPTab";
import SuperAdminCTATab from "@/components/SuperAdminCTATab";

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
  checkout_url?: string | null; asaas_payment_link_id?: string | null;
  stripe_price_id?: string | null; stripe_product_id?: string | null;
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
  const { isAdmin, loading: authLoading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricing[]>([]);
  const [editingPricing, setEditingPricing] = useState<Record<string, Partial<ModelPricing>>>({});
  const [loading, setLoading] = useState(true);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>([]);

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
  const [pkgCheckoutUrl, setPkgCheckoutUrl] = useState("");
  const [pkgAsaasLinkId, setPkgAsaasLinkId] = useState("");
  const [pkgStripePriceId, setPkgStripePriceId] = useState("");
  const [primaryGateway, setPrimaryGateway] = useState<"asaas" | "stripe">("asaas");
  const [manualDepositLink, setManualDepositLink] = useState<string>("https://w.app/ia_programador");
  const [showCredit, setShowCredit] = useState(true);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitPercent, setSplitPercent] = useState("30");

  // Configurações de WhatsApp
  const [rechargeWhatsappLink, setRechargeWhatsappLink] = useState("https://wa.me/5514991611225?text=Ol%C3%A1%2C%20quero%20fazer%20uma%20recarga%20no%20IA%20PROGRAMADOR");
  const [rechargeButtonEnabled, setRechargeButtonEnabled] = useState(true);
  const [rechargeButtonText, setRechargeButtonText] = useState("💬 Falar no WhatsApp para Recarga");
  const [extensionWhatsappLink, setExtensionWhatsappLink] = useState("https://wa.me/5514991611225?text=Ol%C3%A1%2C%20quero%20fazer%20uma%20recarga%20no%20IA%20PROGRAMADOR");
  const [extensionButtonEnabled, setExtensionButtonEnabled] = useState(true);
  const [extensionButtonText, setExtensionButtonText] = useState("🛒 Comprar Extensão/Licença");

  // Notification
  const [notifUserId, setNotifUserId] = useState("all");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");

  // Remarketing filter
  const [leadFilter, setLeadFilter] = useState<"all" | "active" | "inactive" | "never_paid">("all");

  // AI Balances
  const [aiBalances, setAiBalances] = useState<Record<string, { balance: string | null; error: string | null; currency: string }> | null>(null);
  const [loadingAiBalances, setLoadingAiBalances] = useState(false);
  const [aiBalancesCheckedAt, setAiBalancesCheckedAt] = useState<string | null>(null);

  const fetchAiBalances = async () => {
    setLoadingAiBalances(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-balance-check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAiBalances(data.balances);
      setAiBalancesCheckedAt(data.checkedAt);

      // Alertar saldos baixos
      const low = Object.entries(data.balances as Record<string, any>)
        .filter(([, v]) => v.low)
        .map(([k]) => k);
      if (low.length > 0) {
        toast.warning(`⚠️ Saldo baixo: ${low.join(", ")}. Recarregue antes de acabar.`);
      } else {
        toast.success("Saldos sincronizados com sucesso!");
      }
    } catch (e: any) {
      toast.error("Erro ao buscar saldos: " + e.message);
    }
    setLoadingAiBalances(false);
  };

  // Admin verification
  const [verificationCode, setVerificationCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [verificationMode, setVerificationMode] = useState<"code" | "password">("password");
  // Login local do Super Admin (quando o usuário não está logado ou não tem permissão)
  const [gateEmail, setGateEmail] = useState("");
  const [gatePassword, setGatePassword] = useState("");
  const [gateLoading, setGateLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (isAdmin || (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map((e: string) => e.trim()).includes(user?.email || ""))) fetchAll();
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
    const { data: setts } = await supabase.from("app_settings").select("*").in("key", ["primary_gateway", "manual_deposit_link"]);
    if (setts) {
      const pg = setts.find(s => s.key === "primary_gateway");
      if (pg) setPrimaryGateway(pg.value as any);
      
      const ml = setts.find(s => s.key === "manual_deposit_link");
      if (ml) setManualDepositLink(ml.value as any);
      else setManualDepositLink("https://w.app/ia_programador");
    }

    // Fetch show_credit setting
    const { data: creditSetting } = await supabase.from("app_settings").select("value").eq("key", "show_credit").maybeSingle();
    if (creditSetting) setShowCredit(creditSetting.value !== "false");

    // Fetch split settings
    const { data: splitSettings } = await supabase.from("app_settings").select("key, value").in("key", ["split_enabled", "split_percent"]);
    splitSettings?.forEach((s: any) => {
      if (s.key === "split_enabled") setSplitEnabled(s.value === "true");
      if (s.key === "split_percent") setSplitPercent(s.value || "30");
    });

    // Fetch WhatsApp settings
    const { data: whatsappSettings } = await supabase
      .from("app_settings")
      .select("*")
      .in("key", [
        "recharge_whatsapp_link",
        "recharge_button_enabled",
        "recharge_button_text",
        "extension_whatsapp_link",
        "extension_button_enabled",
        "extension_button_text"
      ]);
    
    if (whatsappSettings) {
      whatsappSettings.forEach((setting) => {
        switch (setting.key) {
          case "recharge_whatsapp_link":
            setRechargeWhatsappLink(setting.value);
            break;
          case "recharge_button_enabled":
            setRechargeButtonEnabled(setting.value === "true");
            break;
          case "recharge_button_text":
            setRechargeButtonText(setting.value);
            break;
          case "extension_whatsapp_link":
            setExtensionWhatsappLink(setting.value);
            break;
          case "extension_button_enabled":
            setExtensionButtonEnabled(setting.value === "true");
            break;
          case "extension_button_text":
            setExtensionButtonText(setting.value);
            break;
        }
      });
    }

    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data as any[]);
    if (pricingRes.data) {
      setModelPricing(pricingRes.data as any[]);
      if (!calcModel && (pricingRes.data as any[]).length > 0) setCalcModel((pricingRes.data as any[])[0].model_id);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
    toast.success("Dados atualizados!");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
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
  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      setLoading(true);
      
      // Update profile
      await supabase.from("profiles").update({ 
        full_name: newFullName,
        updated_at: new Date().toISOString()
      }).eq("id", editingUser.id);
      
      // Update roles (remove all, then add new ones)
      await supabase.from("user_roles").delete().eq("user_id", editingUser.id);
      
      if (newUserRoles.length > 0) {
        await supabase.from("user_roles").insert(
          newUserRoles.map(role => ({ user_id: editingUser.id, role: role as any }))
        );
      }
      
      toast.success("Usuário atualizado com sucesso!");
      setIsUserDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error("Erro ao atualizar usuário: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setNewFullName(user.full_name || "");
    setNewUserRoles(user.roles);
    setIsUserDialogOpen(true);
  };

  const toggleUserBlock = async (userId: string, roles: string[]) => {
    const isBlocked = roles.includes("blocked");
    if (isBlocked) {
      // Desbloquear: remove a role "blocked"
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "blocked" as any);
      toast.success("Usuário desbloqueado com sucesso!");
    } else {
      // Bloquear: insere a role "blocked"
      await supabase.from("user_roles").insert({ user_id: userId, role: "blocked" } as any);
      toast.success("Usuário bloqueado do acesso à IA!");
    }
    fetchAll();
  };

  const toggleApiCostOnly = async (userId: string, roles: string[]) => {
    const isApiCostOnly = roles.includes("api_cost_only");
    if (isApiCostOnly) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "api_cost_only" as any);
      toast.success("Usuário voltou a pagar preço de revenda.");
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "api_cost_only" } as any);
      toast.success("Usuário liberado para pagar somente custo de API.");
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

  const createDefaultPackages = async () => {
    setLoading(true);
    const defaultPrices = [10, 30, 50, 100, 200, 500];
    const newPackages = defaultPrices.map(price => {
      const credits = price * 100; // 1 centavo = R$ 0,01 de saldo
      return {
        name: price <= 30 ? "Pacote Starter" : price <= 100 ? "Pacote Business" : "Pacote Pro Max",
        description: `Pacote de recarga de R$ ${price.toFixed(2)}. Saldo em Reais válido para uso em todos os modelos de IA.`,
        price_brl: price * 100,
        credits_amount: credits,
        is_active: true
      };
    });

    try {
      await supabase.from("packages").insert(newPackages as any[]);
      toast.success("Pacotes padrão gerados com sucesso!");
      fetchAll();
    } catch (e) {
      toast.error("Erro ao gerar pacotes");
    } finally {
      setLoading(false);
    }
  };

  const reajustAllPackages = async () => {
    setLoading(true);
    try {
      const { data: pkgs } = await supabase.from("packages").select("*");
      if (!pkgs) return;
      
      const updates = pkgs.map(pkg => 
        supabase.from("packages")
          .update({ credits_amount: pkg.price_brl } as any)
          .eq("id", pkg.id)
      );
      
      await Promise.all(updates);
      toast.success("Todos os pacotes foram reajustados para Real!");
      fetchAll();
    } catch (e) {
      toast.error("Erro ao reajustar pacotes");
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
          checkout_url: pkgCheckoutUrl || null,
          asaas_payment_link_id: pkgAsaasLinkId || null,
          stripe_price_id: pkgStripePriceId || null,
        } as any).eq("id", editingPkg.id);
        toast.success("Pacote atualizado com sucesso!");
      } else {
        await supabase.from("packages").insert({
          name: pkgName,
          description: pkgDesc || null,
          credits_amount: credits,
          price_brl: price,
          checkout_url: pkgCheckoutUrl || null,
          asaas_payment_link_id: pkgAsaasLinkId || null,
          stripe_price_id: pkgStripePriceId || null,
        } as any);
        toast.success("Pacote criado com sucesso!");
      }
      resetPkgForm();
      fetchAll();
    } catch (error: any) {
      toast.error("Erro ao salvar pacote: " + (error?.message || String(error)));
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
    const nextValue = field === "is_active" ? value === "1" : parseInt(value) || 0;
    setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], [field]: nextValue } }));
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

  // Package values simplified

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

  // Simple price change handler
  const handlePriceChange = (price: string) => {
    setPkgPrice(price);
    const priceNum = parseFloat(price);
    if (!isNaN(priceNum) && priceNum > 0) {
      // 1 centavo de real = R$ 0,01 de saldo
      const credits = Math.round(priceNum * 100);
      setPkgCredits(credits.toString());
      
      if (!pkgName || pkgName === "") {
        setPkgName(`Recarga R$ ${priceNum.toFixed(2)}`);
      }
      
      if (!pkgDesc || pkgDesc === "") {
        setPkgDesc(`Adicione R$ ${priceNum.toFixed(2)} ao seu saldo para uso imediato em tokens de IA.`);
      }
    }
  };

  const validatePackage = () => {
    if (!pkgName.trim()) { toast.error("Nome do pacote é obrigatório"); return false; }
    if (!pkgCredits || parseInt(pkgCredits) <= 0) { toast.error("Valor do saldo deve ser maior que zero"); return false; }
    if (!pkgPrice || parseFloat(pkgPrice) <= 0) { toast.error("Preço deve ser maior que zero"); return false; }
    return true;
  };

  const totalRevenue = users.reduce((s, u) => s + u.total_deposited_cents, 0);
  const totalSpent = users.reduce((s, u) => s + u.total_spent_cents, 0);
  const totalBalance = users.reduce((s, u) => s + u.balance_cents, 0);

  const filteredLeads = leadFilter === "all" ? leads :
    leadFilter === "active" ? leads.filter(l => l.has_paid) :
    leadFilter === "inactive" ? leads.filter(l => l.has_paid && l.status === "inactive") :
    leads.filter(l => !l.has_paid);

  const HARDCODED_ADMIN_EMAILS = [
    "escarpelineparticular@gmail.com",
    "escarpelineparticular2@gmail.com",
    "empresasescarpeline@gmail.com",
  ];
  const ENV_ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map((e: string) => e.trim()).filter(Boolean);
  const ADMIN_EMAILS = Array.from(new Set([...HARDCODED_ADMIN_EMAILS, ...ENV_ADMIN_EMAILS]));
  const isAdminEmail = ADMIN_EMAILS.includes((user?.email || "").toLowerCase()) || ADMIN_EMAILS.includes(user?.email || "");
  const hasAccess = isAdmin || isAdminEmail;

  // Tentativa de login direto pela tela do Super Admin (não vaza nenhum email no DOM)
  const handleGateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailNorm = gateEmail.trim().toLowerCase();
    if (!emailNorm || !gatePassword) {
      toast.error("Preencha email e senha.");
      return;
    }
    const allowed = ADMIN_EMAILS.map(x => x.toLowerCase()).includes(emailNorm);
    if (!allowed) {
      // Mensagem genérica — não revela whitelist
      toast.error("Credenciais inválidas.");
      return;
    }
    setGateLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailNorm, password: gatePassword });
    setGateLoading(false);
    if (error) {
      toast.error("Credenciais inválidas.");
      return;
    }
    setGateEmail("");
    setGatePassword("");
    toast.success("Login realizado.");
  };

  // Generate and send verification code
  const sendVerificationCode = async () => {
    if (!isAdminEmail) {
      toast.error("Apenas o Super Admin pode receber código de verificação");
      return;
    }
    
    setSendingCode(true);
    try {
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setVerificationCode(code);
      
      // Store in sessionStorage for verification (temporary, expires on page close)
      sessionStorage.setItem("superadmin_verification_code", code);
      sessionStorage.setItem("superadmin_code_timestamp", Date.now().toString());
      
      // Send email via Resend or Edge Function
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      
      const adminEmail = user?.email || ADMIN_EMAILS[0] || "";
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/send-notification`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          action: "send-admin-code",
          email: adminEmail,
          code: code,
          userEmail: user?.email,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (!res.ok) {
        toast.success(`Código gerado: ${code}`, { duration: 10000 });
        toast.info("Código também foi enviado para o email do Super Admin", { duration: 5000 });
      } else {
        toast.success(`Código de verificação enviado para ${adminEmail}`);
      }
    } catch (err) {
      console.error("Error sending code:", err);
      toast.error("Erro ao enviar código. Tente novamente.");
    }
    setSendingCode(false);
  };
  
  const verifyCode = () => {
    const storedCode = sessionStorage.getItem("superadmin_verification_code");
    const timestamp = sessionStorage.getItem("superadmin_code_timestamp");
    
    if (!storedCode || !timestamp) {
      toast.error("Código expirado. Solicite um novo.");
      return;
    }
    
    // Check if code is expired (10 minutes)
    const codeAge = Date.now() - parseInt(timestamp);
    if (codeAge > 10 * 60 * 1000) {
      sessionStorage.removeItem("superadmin_verification_code");
      sessionStorage.removeItem("superadmin_code_timestamp");
      toast.error("Código expirado. Solicite um novo.");
      return;
    }
    
    if (inputCode === storedCode) {
      setIsVerified(true);
      sessionStorage.setItem("superadmin_verified", "true");
      toast.success("Código verificado! Acesso liberado.");
    } else {
      toast.error("Código incorreto. Tente novamente.");
    }
  };

  // Verifica a senha do Super Admin via Edge Function (segredo fica só no backend)
  const verifyWithPassword = async () => {
    if (!adminPassword) return;
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/superadmin-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setIsVerified(true);
        sessionStorage.setItem("superadmin_verified", "true");
        setAdminPassword("");
        toast.success("Acesso liberado.");
      } else {
        toast.error("Senha incorreta.");
      }
    } catch {
      toast.error("Falha ao verificar. Tente novamente.");
    }
  };
  
  // Check if already verified in this session
  useEffect(() => {
    const verified = sessionStorage.getItem("superadmin_verified");
    if (verified === "true") {
      setIsVerified(true);
    }
  }, []);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  // Tela de login do Super Admin — não exibe nenhum email no DOM
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <CardTitle>Área restrita</CardTitle>
            <CardDescription>Faça login para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGateLogin} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="gate-email">Email</Label>
                <Input
                  id="gate-email"
                  type="email"
                  autoComplete="off"
                  placeholder="seu@email.com"
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-password">Senha</Label>
                <Input
                  id="gate-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={gatePassword}
                  onChange={(e) => setGatePassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={gateLoading}>
                {gateLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Entrar
              </Button>
              {user?.email && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={async () => { await signOut(); }}
                >
                  Sair da sessão atual
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification screen for admin emails
  if (isAdminEmail && !isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <CardTitle>Verificação de Segurança</CardTitle>
            <CardDescription>
              Acesso restrito ao Super Admin. Escolha uma forma de verificação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tabs para escolher modo de verificação */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={verificationMode === "code" ? "default" : "outline"}
                onClick={() => setVerificationMode("code")}
                className="flex-1"
                size="sm"
              >
                <Mail className="w-4 h-4 mr-2" />
                Código por Email
              </Button>
              <Button
                variant={verificationMode === "password" ? "default" : "outline"}
                onClick={() => setVerificationMode("password")}
                className="flex-1"
                size="sm"
              >
                <Shield className="w-4 h-4 mr-2" />
                Senha
              </Button>
            </div>

            {verificationMode === "code" ? (
              <>
                {!verificationCode ? (
                  <Button 
                    onClick={sendVerificationCode} 
                    disabled={sendingCode}
                    className="w-full"
                  >
                    {sendingCode ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {sendingCode ? "Enviando..." : "Receber Código de Acesso"}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="code">Código de 6 dígitos</Label>
                      <Input
                        id="code"
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                      />
                      <p className="text-xs text-muted-foreground">
                        O código foi enviado para o email do Super Admin.
                      </p>
                    </div>
                    <Button 
                      onClick={verifyCode} 
                      disabled={inputCode.length !== 6}
                      className="w-full"
                    >
                      Verificar Código
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={sendVerificationCode}
                      disabled={sendingCode}
                      className="w-full"
                    >
                      {sendingCode ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Reenviar Código
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Senha do Super Admin</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Digite a senha..."
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verifyWithPassword()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite a senha do Super Admin para continuar.
                  </p>
                </div>
                <Button 
                  onClick={verifyWithPassword} 
                  disabled={!adminPassword}
                  className="w-full"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Entrar com Senha
                </Button>
              </>
            )}
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = "/"}
              className="w-full"
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <Button variant="outline" size="sm" onClick={() => navigate("/")}><X className="w-4 h-4 mr-1" /> Voltar</Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Atualizando..." : "Atualizar"}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" /> Sair
            </Button>
          </div>
        </div>

        {/* Alerta de saldos baixos */}
        {aiBalances && Object.entries(aiBalances).some(([, v]: any) => v.low) && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-4 py-3">
            <span className="text-yellow-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-500">Saldo baixo detectado</p>
              <p className="text-xs text-muted-foreground">
                {Object.entries(aiBalances)
                  .filter(([, v]: any) => v.low)
                  .map(([k, v]: any) => `${k} (${v.balance} ${v.currency})`)
                  .join(" · ")}
              </p>
            </div>
            <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10" onClick={fetchAiBalances}>
              <RefreshCw className="w-3 h-3 mr-1" /> Verificar
            </Button>
          </div>
        )}

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
            <TabsTrigger value="vip" className="flex items-center gap-2"><Crown className="w-4 h-4" /> VIP</TabsTrigger>
            <TabsTrigger value="cta" className="flex items-center gap-2"><ExternalLink className="w-4 h-4" /> CTA</TabsTrigger>
            <TabsTrigger value="remarketing">Remarketing</TabsTrigger>
            <TabsTrigger value="packages">Pacotes</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques</TabsTrigger>
            <TabsTrigger value="calculator">Calculadora</TabsTrigger>
            <TabsTrigger value="credits">Créditos</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="w-4 h-4" /> Configurações</TabsTrigger>
            <TabsTrigger value="ai-balances" className="flex items-center gap-2"><Cpu className="w-4 h-4" /> Saldos IA</TabsTrigger>
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
                        const isApiCostOnly = u.roles.includes("api_cost_only");
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
                              <Button size="icon" variant="ghost" className={`h-8 w-8 ${isApiCostOnly ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`} onClick={() => toggleApiCostOnly(u.id, u.roles)} title={isApiCostOnly ? "Desativar custo de API puro" : "Liberar para pagar só custo da API"}>
                                <DollarSign className="h-4 w-4" />
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
                  <CardDescription>Configure preços e ative/desative quais IAs aparecem e podem ser usadas no app do usuário.</CardDescription>
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
                        {modelPricing.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              <div className="space-y-2">
                                <p className="font-medium">Nenhum modelo de IA cadastrado</p>
                                <p className="text-xs">Execute a migration para popular a tabela ai_model_pricing</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : modelPricing.map(mp => {
                          const apiIn = Number(getVal(mp, "api_cost_input_per_million"));
                          const apiOut = Number(getVal(mp, "api_cost_output_per_million"));
                          const resIn = Number(getVal(mp, "resale_price_input_per_million"));
                          const resOut = Number(getVal(mp, "resale_price_output_per_million"));
                          const totalApi = apiIn + apiOut;
                          const totalResale = resIn + resOut;
                          const marginPct = totalApi > 0 ? ((totalResale - totalApi) / totalApi * 100).toFixed(0) : "∞";
                          const hasEdits = !!editingPricing[mp.id];
                          const activeVal = Boolean(editingPricing[mp.id]?.is_active ?? mp.is_active);

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
                                  onClick={() => updatePricingField(mp.id, "is_active", activeVal ? "0" : "1")}
                                  className={`w-8 h-4 rounded-full transition-colors ${activeVal ? "bg-[hsl(var(--success))]" : "bg-muted"}`}
                                >
                                  <div className={`w-3 h-3 bg-background rounded-full transition-transform ${activeVal ? "translate-x-4" : "translate-x-0.5"}`} />
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

          {/* VIP Users */}
          <TabsContent value="vip">
            <SuperAdminVIPTab />
          </TabsContent>

          {/* CTA */}
          <TabsContent value="cta">
            <SuperAdminCTATab />
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
                      <Button variant="outline" size="sm" onClick={reajustAllPackages} disabled={loading} className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50">
                        <TrendingUp className="w-4 h-4 mr-1.5" /> Reajustar Todos (Real)
                      </Button>
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
                    <div className="bg-primary/5 rounded-lg p-4 mb-4 border border-primary/20">
                      <p className="text-sm font-semibold flex items-center gap-2 text-primary">
                        <Package className="w-4 h-4" />
                        Configuração de Créditos em Real (BRL)
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">1 Crédito = 1 Centavo</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        O sistema agora opera 100% em Real. Ao definir o preço, a quantidade de créditos (tokens) deve ser o valor total em centavos para manter a proporção correta de consumo.
                      </p>
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
                {packages.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-muted-foreground">
                  <p>Nenhum pacote cadastrado</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowPkgForm(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Criar primeiro pacote
                  </Button>
                </div>
              ) : packages.map(pkg => (
                  <Card key={pkg.id} className={pkg.is_active ? "" : "opacity-50"}>
                    <CardHeader>
                      <div className="flex justify-between"><Package className="w-6 h-6 text-primary" /><Badge>{pkg.is_active ? "Ativo" : "Inativo"}</Badge></div>
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">R$ {(pkg.price_brl / 100).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{formatCreditsAsBRL(pkg.credits_amount)} de saldo</p>
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

                {/* Toggle: Feito por O.Scarpeline */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Exibir "Feito por: O.Scarpeline"</p>
                    <p className="text-xs text-muted-foreground">Controla a exibição do crédito no cabeçalho do editor.</p>
                  </div>
                  <button
                    onClick={async () => {
                      const newVal = !showCredit;
                      setShowCredit(newVal);
                      await supabase.from("app_settings").upsert({ key: "show_credit", value: newVal.toString() as any }, { onConflict: "key" });
                      toast.success(newVal ? "Crédito exibido!" : "Crédito ocultado!");
                    }}
                    className={`w-12 h-6 rounded-full transition-colors ${showCredit ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <div className={`w-5 h-5 bg-background rounded-full transition-transform mx-0.5 ${showCredit ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Gateway de Pagamento Primário</h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchAll}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" /> Atualizar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selecione qual gateway será usado por padrão para processar novos pagamentos.
                  </p>
                  <div className="flex gap-4">
                    <Button 
                      variant={primaryGateway === "asaas" ? "default" : "outline"}
                      onClick={async () => {
                        setPrimaryGateway("asaas");
                        await supabase.from("app_settings").upsert({ key: "primary_gateway", value: "asaas" as any }, { onConflict: "key" });
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
                        await supabase.from("app_settings").upsert({ key: "primary_gateway", value: "stripe" as any }, { onConflict: "key" });
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

                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold">Link de Depósito Manual</h3>
                  <p className="text-sm text-muted-foreground">
                    Define para onde o botão "Fazer depósito" na carteira do usuário redirecionará.
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      value={manualDepositLink} 
                      onChange={(e) => setManualDepositLink(e.target.value)} 
                      placeholder="https://w.app/..." 
                    />
                    <Button 
                      onClick={async () => {
                        await supabase.from("app_settings").upsert({ 
                          key: "manual_deposit_link", 
                          value: manualDepositLink as any 
                        }, { onConflict: "key" });
                        toast.success("Link de depósito manual atualizado!");
                      }}
                    >
                      Salvar Link
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-6">
                  <h3 className="text-lg font-semibold">Configurações de WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure os links de WhatsApp para recarga manual e compra de extensões.
                  </p>
                  
                  {/* Configurações de Recarga */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Botão de Recarga
                    </h4>
                    
                    <div className="flex items-center gap-4">
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4"
                          checked={rechargeButtonEnabled}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            setRechargeButtonEnabled(newValue);
                            await supabase.from("app_settings").upsert({ 
                              key: "recharge_button_enabled", 
                              value: newValue.toString() as any 
                            }, { onConflict: "key" });
                            toast.success(newValue ? "Botão de recarga ativado" : "Botão de recarga desativado");
                          }}
                        />
                        <span>Ativar botão de recarga</span>
                      </Label>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="recharge-text">Texto do Botão</Label>
                      <Input 
                        id="recharge-text"
                        value={rechargeButtonText}
                        onChange={(e) => setRechargeButtonText(e.target.value)}
                        onBlur={async (e) => {
                          await supabase.from("app_settings").upsert({ 
                            key: "recharge_button_text", 
                            value: e.target.value as any 
                          }, { onConflict: "key" });
                          toast.success("Texto do botão atualizado");
                        }}
                        placeholder="Ex: 💬 Falar no WhatsApp para Recarga"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="recharge-link">Link WhatsApp para Recarga</Label>
                      <Input 
                        id="recharge-link"
                        value={rechargeWhatsappLink}
                        onChange={(e) => setRechargeWhatsappLink(e.target.value)}
                        onBlur={async (e) => {
                          await supabase.from("app_settings").upsert({ 
                            key: "recharge_whatsapp_link", 
                            value: e.target.value as any 
                          }, { onConflict: "key" });
                          toast.success("Link de recarga atualizado");
                        }}
                        placeholder="https://wa.me/..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Link que será aberto quando o usuário clicar no botão de recarga.
                      </p>
                    </div>
                  </div>
                  
                  {/* Configurações de Extensão */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> Botão de Comprar Extensão
                    </h4>
                    
                    <div className="flex items-center gap-4">
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4"
                          checked={extensionButtonEnabled}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            setExtensionButtonEnabled(newValue);
                            await supabase.from("app_settings").upsert({ 
                              key: "extension_button_enabled", 
                              value: newValue.toString() as any 
                            }, { onConflict: "key" });
                            toast.success(newValue ? "Botão de extensão ativado" : "Botão de extensão desativado");
                          }}
                        />
                        <span>Ativar botão de extensão</span>
                      </Label>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="extension-text">Texto do Botão</Label>
                      <Input 
                        id="extension-text"
                        value={extensionButtonText}
                        onChange={(e) => setExtensionButtonText(e.target.value)}
                        onBlur={async (e) => {
                          await supabase.from("app_settings").upsert({ 
                            key: "extension_button_text", 
                            value: e.target.value as any 
                          }, { onConflict: "key" });
                          toast.success("Texto do botão atualizado");
                        }}
                        placeholder="Ex: 🛒 Comprar Extensão/Licença"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="extension-link">Link WhatsApp para Extensão</Label>
                      <Input 
                        id="extension-link"
                        value={extensionWhatsappLink}
                        onChange={(e) => setExtensionWhatsappLink(e.target.value)}
                        onBlur={async (e) => {
                          await supabase.from("app_settings").upsert({ 
                            key: "extension_whatsapp_link", 
                            value: e.target.value as any 
                          }, { onConflict: "key" });
                          toast.success("Link de extensão atualizado");
                        }}
                        placeholder="https://wa.me/..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Link que será aberto quando o usuário clicar no botão de comprar extensão.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  {/* Split de Pagamento */}
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          Split de Pagamento (Afiliados)
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${splitEnabled ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"}`}>
                            {splitEnabled ? "ATIVO" : "INATIVO"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Quando ativo, divide automaticamente cada PIX recebido com o afiliado no momento do depósito.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const newVal = !splitEnabled;
                          setSplitEnabled(newVal);
                          await supabase.from("app_settings").upsert({ key: "split_enabled", value: newVal.toString() as any }, { onConflict: "key" });
                          toast.success(newVal ? "Split ativado!" : "Split desativado!");
                        }}
                        className={`w-12 h-6 rounded-full transition-colors shrink-0 ${splitEnabled ? "bg-green-500" : "bg-muted-foreground/30"}`}
                      >
                        <div className={`w-5 h-5 bg-background rounded-full transition-transform mx-0.5 ${splitEnabled ? "translate-x-6" : "translate-x-0"}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1">% de split para o afiliado</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="50"
                            value={splitPercent}
                            onChange={(e) => setSplitPercent(e.target.value)}
                            className="w-24 h-8 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={async () => {
                            await supabase.from("app_settings").upsert({ key: "split_percent", value: splitPercent as any }, { onConflict: "key" });
                            toast.success(`Split configurado para ${splitPercent}%`);
                          }}>
                            Salvar %
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-yellow-600">⚠️ Atenção antes de ativar:</p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>O split é calculado sobre o <strong>depósito total</strong>, não sobre o lucro</li>
                        <li>O afiliado precisa ter uma <strong>conta Asaas cadastrada</strong> (wallet ID)</li>
                        <li>Requer configurar o <strong>wallet_id</strong> de cada afiliado no perfil</li>
                        <li>Atualmente o sistema paga comissão sobre o <strong>lucro real</strong> — mais justo</li>
                        <li>Ative apenas se migrar o modelo de comissão para % do depósito</li>
                      </ul>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 text-destructive">Zona de Perigo</h3>
                  <p className="text-xs text-muted-foreground mb-4">Ações irreversíveis que impactam dados sensíveis.</p>
                  <Button variant="destructive" onClick={async () => {
                    if (!confirm("Deseja realmente limpar TODOS os logs de transação? Esta ação não pode ser desfeita.")) return;
                    const secondConfirm = prompt('Digite "CONFIRMAR" para prosseguir:');
                    if (secondConfirm !== "CONFIRMAR") { toast.error("Operação cancelada."); return; }
                    try {
                      const { error } = await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                      if (error) throw error;
                      toast.success("Histórico de transações limpo com sucesso.");
                      fetchAll();
                    } catch (e: any) {
                      toast.error("Erro ao limpar histórico: " + e.message);
                    }
                  }}>
                    Limpar Histórico de Transações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* AI Balances */}
          <TabsContent value="ai-balances">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5 text-primary" /> Saldos das IAs</CardTitle>
                  <CardDescription>
                    Saldo disponível em cada provedor de IA configurado.
                    {aiBalancesCheckedAt && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Atualizado: {new Date(aiBalancesCheckedAt).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={fetchAiBalances} disabled={loadingAiBalances} className="gap-2">
                  {loadingAiBalances ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {loadingAiBalances ? "Verificando..." : "Sincronizar Saldos"}
                </Button>
              </CardHeader>
              <CardContent>
                {!aiBalances ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Cpu className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Clique em "Sincronizar Saldos" para verificar o saldo de cada IA.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: "gemini",      name: "Gemini (Google)",       icon: "✨", color: "text-blue-400" },
                      { id: "deepseek",    name: "DeepSeek",              icon: "💻", color: "text-purple-400" },
                      { id: "kimi",        name: "Kimi (Moonshot)",       icon: "🧠", color: "text-red-400" },
                      { id: "groq",        name: "Groq (Llama 4 Scout)",  icon: "⚡", color: "text-yellow-400" },
                      { id: "anthropic",   name: "Anthropic (Claude)",    icon: "🤖", color: "text-orange-400" },
                      { id: "openrouter",  name: "OpenRouter",            icon: "🌐", color: "text-green-400" },
                      { id: "openai",      name: "OpenAI (GPT-4o mini)",  icon: "🔮", color: "text-cyan-400" },
                    ].map(({ id, name, icon, color }) => {
                      const info = aiBalances[id];
                      const hasBalance = info?.balance !== null;
                      const isLow = false;
                      const hasError = !!info?.error;
                      return (
                        <Card key={id} className={`border ${isLow ? "border-yellow-500/60 bg-yellow-500/5" : hasBalance ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{icon}</span>
                                <div>
                                  <p className={`font-semibold ${color}`}>{name}</p>
                                  <p className="text-xs text-muted-foreground">{info?.currency || "USD"}</p>
                                </div>
                              </div>
                              <Badge variant={isLow ? "outline" : hasBalance ? "default" : "destructive"}
                                className={isLow ? "border-yellow-500 text-yellow-500" : ""}>
                                {isLow ? "⚠️ Baixo" : hasBalance ? "✓ Ativo" : "✗ Erro"}
                              </Badge>
                            </div>
                            <div className="mt-2">
                              {hasBalance ? (
                                <p className="text-xl font-bold text-foreground">
                                  {info.balance}
                                  {info.currency && !info.balance?.includes("válida") && !info.balance?.includes("Gratuito") && (
                                    <span className="text-sm font-normal text-muted-foreground ml-1">{info.currency}</span>
                                  )}
                                </p>
                              ) : (
                                <p className="text-sm text-destructive">{info?.error || "Sem informação"}</p>
                              )}
                              {isLow && (
                                <p className="text-xs text-yellow-500 mt-1 font-medium">⚠️ Saldo baixo — recarregue em breve</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdmin;
