import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Link2, DollarSign, Users, Copy, Loader2, Shield, Save, Wallet, CheckCircle2, ChevronDown, ChevronUp, Zap } from "lucide-react";

interface Commission {
  id: string;
  commission_cents: number;
  status: string;
  created_at: string;
  referred_email?: string;
}

const AffiliateDashboard = () => {
  const { user, profile, isAffiliate, isAdmin, loading: authLoading, refetchData } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingAffiliate, setActivatingAffiliate] = useState(false);

  useEffect(() => {
    if (!authLoading && user && (isAffiliate || isAdmin)) {
      fetchCommissions();
    } else {
      setLoading(false);
    }
  }, [authLoading, user, isAffiliate, isAdmin]);

  const fetchCommissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("affiliate_commissions")
      .select("id, commission_cents, status, created_at, referred_user_id")
      .eq("affiliate_user_id", user!.id)
      .order("created_at", { ascending: false });

    if (data) {
      const referredIds = (data as any[]).map((c) => c.referred_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", referredIds);

      const enriched = (data as any[]).map((c) => ({
        ...c,
        referred_email: (profiles as any[])?.find((p) => p.id === c.referred_user_id)?.email || "—",
      }));
      setCommissions(enriched);
    }
    setLoading(false);
  };

  const activateAffiliate = async () => {
    if (!user) return;
    setActivatingAffiliate(true);
    const { data: code } = await supabase.rpc("generate_affiliate_code" as any);
    if (code) {
      await supabase.from("profiles").update({ affiliate_code: code as string } as any).eq("id", user.id);
      await supabase.from("user_roles").insert({ user_id: user.id, role: "affiliate" } as any);
      toast.success(`Programa ativado! Código: ${code}`);
      refetchData();
    }
    setActivatingAffiliate(false);
  };

  const [pixKey, setPixKey] = useState(profile?.pix_key || "");
  const [pixKeyType, setPixKeyType] = useState((profile as any)?.pix_key_type || "cpf");
  const [savingPix, setSavingPix] = useState(false);

  // Asaas wallet
  const [hasWallet, setHasWallet] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [walletForm, setWalletForm] = useState({
    name: "", email: "", cpf_cnpj: "", birth_date: "",
    mobile_phone: "", address: "", address_number: "",
    province: "", postal_code: "", income_value: "",
  });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  useEffect(() => {
    checkWalletStatus();
  }, [user]);

  const checkWalletStatus = async () => {
    if (!user) return;
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas-affiliate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-wallet-status" }),
      });
      const data = await res.json();
      setHasWallet(data.has_wallet);
      setWalletId(data.wallet_id || null);
    } catch (_) {}
  };

  const handleCreateWallet = async () => {
    if (!user) return;
    const f = walletForm;
    if (!f.name || !f.email || !f.cpf_cnpj || !f.mobile_phone || !f.address || !f.address_number || !f.postal_code || !f.income_value) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setCreatingWallet(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas-affiliate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-wallet", ...f }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHasWallet(true);
      setWalletId(data.wallet_id);
      setShowWalletForm(false);
      toast.success(data.message || "Conta Asaas criada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta Asaas");
    }
    setCreatingWallet(false);
  };

  const wf = (field: string, value: string) => setWalletForm(p => ({ ...p, [field]: value }));

  const savePix = async () => {
    if (!pixKey) {
      toast.error("Informe a chave PIX");
      return;
    }
    setSavingPix(true);
    const { error } = await supabase.from("profiles").update({ 
      pix_key: pixKey,
      pix_key_type: pixKeyType
    } as any).eq("id", user?.id);

    if (error) toast.error("Erro ao salvar chave PIX");
    else toast.success("Dados de recebimento salvos!");
    setSavingPix(false);
    refetchData();
  };

  const handleWithdraw = async () => {
    if (!profile?.pix_key) {
      toast.error("Cadastre sua chave PIX primeiro");
      return;
    }

    const activeCount = new Set(commissions.filter(c => c.status !== 'failed').map(c => c.referred_email)).size;
    if (activeCount < 3) {
      toast.error(`Você possui apenas ${activeCount} indicações ativas. São necessários no mínimo 3 para realizar saques.`);
      return;
    }

    const withdrawable = commissions
      .filter(c => c.status === 'confirmed')
      .reduce((s, c) => s + c.commission_cents, 0);

    if (withdrawable < 500) {
      toast.error("Valor mínimo para saque: R$ 5,00");
      return;
    }

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user?.id,
      amount_cents: withdrawable,
      pix_key: profile.pix_key,
      pix_key_type: (profile as any).pix_key_type,
      status: 'pending'
    } as any);

    if (error) {
      toast.error("Erro ao solicitar saque");
    } else {
      toast.success("Solicitação de saque enviada com sucesso!");
      refetchData();
    }
  };

  const copyLink = () => {
    if (!profile?.affiliate_code) return;
    const link = `${window.location.origin}/?ref=${profile.affiliate_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const totalEarned = commissions.reduce((s, c) => s + c.commission_cents, 0);
  const pendingEarned = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.commission_cents, 0);

  if (authLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!isAffiliate && !isAdmin) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <Link2 className="w-12 h-12 text-primary mx-auto mb-2" />
          <CardTitle>Programa de Afiliados</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ganhe <span className="text-primary font-bold">30% de comissão</span> sobre o lucro total da plataforma em cada indicação!
            <br />
            <span className="text-[10px] opacity-70">Ex: A cada R$ 100,00 de lucro você ganha R$ 30,00.</span>
          </p>
          <Button onClick={activateAffiliate} disabled={activatingAffiliate}>
            {activatingAffiliate && <Loader2 className="w-4 h-4 animate-spin" />}
            Ativar programa de afiliados
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeCount = new Set(commissions.filter(c => c.status !== 'failed').map(c => c.referred_email)).size;
  const isApproved = activeCount >= 3;

  return (
    <div className="space-y-6">
      {/* Seção Informativa de Comissões */}
      <Card className="border-primary/20 bg-primary/5 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <DollarSign className="w-16 h-16" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Regras do Programa de Afiliados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                30% de Comissão Real
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você recebe <span className="text-foreground font-bold">30% sobre o lucro total</span> gerado por cada recarga dos seus indicados. Diferente de outros programas, nossa comissão é calculada sobre o valor líquido que entra na plataforma.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Regra de Aprovação
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Para desbloquear seu primeiro saque, você precisa de no mínimo <span className="text-foreground font-bold">3 indicados ativos</span> (que realizaram ao menos um depósito). Isso garante a integridade e sustentabilidade do nosso ecossistema.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                Saques e Pagamentos
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O valor mínimo para saque é de <span className="text-foreground font-bold">R$ 5,00</span>. Os pagamentos são processados via PIX. Lembre-se que há uma taxa de transferência de R$ 5,00 cobrada pelo Asaas por transação.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Link Vitalício
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Uma vez que um usuário se cadastra com seu link, ele se torna seu indicado para sempre. Todas as futuras recargas dele gerarão comissões automáticas para você.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {profile?.affiliate_code && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Seu link único de compartilhamento</p>
              <p className="text-sm font-mono text-foreground break-all">
                {window.location.origin}/?ref={profile.affiliate_code}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="w-4 h-4" /> Copiar Link
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <DollarSign className="w-8 h-8 text-[hsl(var(--success))]" />
            <p className="text-2xl font-bold text-foreground mt-2">R$ {(totalEarned / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Lucro Total Acumulado (30%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <DollarSign className="w-8 h-8 text-[hsl(var(--warning))]" />
            <p className="text-2xl font-bold text-foreground mt-2">R$ {(pendingEarned / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Aguardando Saque</p>
          </CardContent>
        </Card>
        <Card className={isApproved ? "border-green-500/50" : "border-yellow-500/50"}>
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <Users className={`w-8 h-8 ${isApproved ? "text-green-500" : "text-yellow-500"}`} />
              <Badge variant={isApproved ? "default" : "secondary"}>
                {isApproved ? "Afiliado Aprovado" : "Aprovação Pendente"}
              </Badge>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Indicados Depositantes (Mínimo 3)</p>
            </div>
            <Button className="mt-4 w-full" variant={isApproved ? "default" : "outline"} size="sm" onClick={handleWithdraw}>
              Solicitar Saque (Manual/PIX)
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados de Recebimento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</label>
                <select 
                  value={pixKeyType} 
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="w-full bg-input border border-border rounded px-2 py-1 text-xs outline-none"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">Email</option>
                  <option value="phone">Celular</option>
                  <option value="random">Chave Aleatória</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Chave PIX</label>
                <input 
                  type="text" 
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Sua chave aqui"
                  className="w-full bg-input border border-border rounded px-2 py-1 text-xs outline-none"
                />
              </div>
            </div>
            <Button className="w-full h-8 text-xs" variant="secondary" onClick={savePix} disabled={savingPix}>
              {savingPix ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Salvar Chave PIX
            </Button>
            <p className="text-[10px] text-muted-foreground leading-tight italic">
              * O Asaas cobra uma taxa média de R$ 5,00 por transferência PIX efetuada. Este valor será descontado do seu saldo de comissão no momento do pagamento.
            </p>
          </CardContent>
        </Card>

        {/* Conta Asaas para Split */}
        <Card className={hasWallet ? "border-green-500/30 bg-green-500/5" : "border-primary/20"}>
          <CardHeader className="pb-2">
            <button className="flex items-center justify-between w-full text-left" onClick={() => !hasWallet && setShowWalletForm(!showWalletForm)}>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                Conta Asaas (Split Automático)
                {hasWallet
                  ? <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-500 rounded-full font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ativa</span>
                  : <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full">Não cadastrada</span>
                }
              </CardTitle>
              {!hasWallet && (showWalletForm ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            {hasWallet ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sua conta está configurada para receber split automático de pagamentos.</p>
                <p className="text-[10px] font-mono text-muted-foreground">Wallet ID: {walletId}</p>
              </div>
            ) : showWalletForm ? (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">Crie sua subconta Asaas para receber comissões automaticamente via split de pagamento.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Nome completo *</label>
                    <Input className="h-8 text-xs" placeholder="Seu nome" value={walletForm.name} onChange={e => wf("name", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Email *</label>
                    <Input className="h-8 text-xs" placeholder="seu@email.com" value={walletForm.email} onChange={e => wf("email", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">CPF ou CNPJ *</label>
                    <Input className="h-8 text-xs" placeholder="000.000.000-00" value={walletForm.cpf_cnpj} onChange={e => wf("cpf_cnpj", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Data de nascimento (PF)</label>
                    <Input className="h-8 text-xs" type="date" value={walletForm.birth_date} onChange={e => wf("birth_date", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Celular *</label>
                    <Input className="h-8 text-xs" placeholder="(11) 99999-9999" value={walletForm.mobile_phone} onChange={e => wf("mobile_phone", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">CEP *</label>
                    <Input className="h-8 text-xs" placeholder="00000-000" value={walletForm.postal_code} onChange={e => wf("postal_code", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Endereço *</label>
                    <Input className="h-8 text-xs" placeholder="Rua, Av..." value={walletForm.address} onChange={e => wf("address", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Número *</label>
                    <Input className="h-8 text-xs" placeholder="123" value={walletForm.address_number} onChange={e => wf("address_number", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Bairro</label>
                    <Input className="h-8 text-xs" placeholder="Centro" value={walletForm.province} onChange={e => wf("province", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Renda mensal (R$) *</label>
                    <Input className="h-8 text-xs" type="number" placeholder="3000" value={walletForm.income_value} onChange={e => wf("income_value", e.target.value)} />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">* Campos obrigatórios. Dados enviados diretamente ao Asaas de forma segura.</p>

                <Button className="w-full h-8 text-xs gap-2" onClick={handleCreateWallet} disabled={creatingWallet}>
                  {creatingWallet ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />}
                  {creatingWallet ? "Criando conta..." : "Criar conta Asaas"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">Clique para cadastrar sua conta e receber split automático quando o admin ativar o recurso.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">          <CardContent className="p-4 flex gap-3 items-start h-full">
            <Shield className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-destructive">Regras Antiburla</p>
              <p className="text-xs text-muted-foreground">
                É terminantemente <strong>proibido</strong> utilizar seu próprio link de indicação para realizar compras. 
                A detecção de autoreferência resultará em <strong>bloqueio imediato da conta</strong>.
                Saques liberados após 3 indicações pagantes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico de Comissões</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : commissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma comissão ainda. Compartilhe seu link!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{new Date(c.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">{c.referred_email}</TableCell>
                    <TableCell className="text-[hsl(var(--success))]">R$ {(c.commission_cents / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        c.status === "paid" ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]" :
                        "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]"
                      }`}>
                        {c.status === "paid" ? "Pago" : "Pendente"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateDashboard;
