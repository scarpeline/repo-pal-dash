import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Link2, DollarSign, Users, Copy, Loader2, Shield, Save } from "lucide-react";

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
  const [pixKeyType, setPixKeyType] = useState(profile?.pix_key_type || "cpf");
  const [savingPix, setSavingPix] = useState(false);

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
      pix_key_type: profile.pix_key_type,
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
            <span className="text-[10px] opacity-70">Ex: A cada R$ 100,00 você ganha R$ 30,00.</span>
          </p>
          <Button onClick={activateAffiliate} disabled={activatingAffiliate}>
            {activatingAffiliate && <Loader2 className="w-4 h-4 animate-spin" />}
            Ativar programa de afiliados
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {profile?.affiliate_code && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Seu link de indicação</p>
              <p className="text-sm font-mono text-foreground break-all">
                {window.location.origin}/?ref={profile.affiliate_code}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="w-4 h-4" /> Copiar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <DollarSign className="w-8 h-8 text-[hsl(var(--success))]" />
            <p className="text-2xl font-bold text-foreground mt-2">R$ {(totalEarned / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total ganho</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <DollarSign className="w-8 h-8 text-[hsl(var(--warning))]" />
            <p className="text-2xl font-bold text-foreground mt-2">R$ {(pendingEarned / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Pendente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <Users className="w-8 h-8 text-primary" />
            <div className="mt-2">
              <p className="text-2xl font-bold text-foreground">{new Set(commissions.map(c => c.referred_email)).size}</p>
              <p className="text-xs text-muted-foreground">Indicações Ativas</p>
            </div>
            <Button className="mt-4 w-full" variant="outline" size="sm" onClick={handleWithdraw}>
              Realizar Saque
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

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex gap-3 items-start h-full">
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
