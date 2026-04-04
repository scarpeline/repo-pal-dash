import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Copy, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function AffiliateSection() {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [pixKey, setPixKey] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const [profileRes, commissionsRes, withdrawalsRes, referralsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase.from("affiliate_commissions").select("*").eq("affiliate_user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id").eq("referred_by", user!.id),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setPixKey(profileRes.data.pix_key || "");
    }
    setCommissions(commissionsRes.data || []);
    setWithdrawals(withdrawalsRes.data || []);
    setReferralCount(referralsRes.data?.length || 0);
  };

  const copyReferralLink = () => {
    if (!profile?.referral_code) return;
    const link = `${window.location.origin}?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const savePixKey = async () => {
    if (!pixKey.trim()) {
      toast.error("Informe sua chave PIX");
      return;
    }
    setSavingPix(true);
    const { error } = await supabase
      .from("profiles")
      .update({ pix_key: pixKey.trim() })
      .eq("id", user!.id);
    setSavingPix(false);
    if (error) {
      toast.error("Erro ao salvar chave PIX");
    } else {
      toast.success("Chave PIX salva!");
      setProfile((p: any) => ({ ...p, pix_key: pixKey.trim() }));
    }
  };

  const pendingCents = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.commission_cents, 0);

  const confirmedCents = commissions
    .filter((c) => c.status === "confirmed" || c.status === "paid")
    .reduce((sum, c) => sum + c.commission_cents, 0);

  const withdrawnCents = withdrawals
    .filter((w) => w.status === "paid")
    .reduce((sum, w) => sum + w.amount_cents, 0);

  const availableCents = confirmedCents - withdrawnCents;

  const requestWithdrawal = async () => {
    if (!profile?.pix_key) {
      toast.error("Cadastre sua chave PIX primeiro");
      return;
    }
    if (availableCents < 500) {
      toast.error("Saldo mínimo para saque: R$ 5,00");
      return;
    }
    setRequestingWithdrawal(true);
    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user!.id,
      amount_cents: availableCents,
      pix_key: profile.pix_key,
      status: "pending",
    });
    setRequestingWithdrawal(false);
    if (error) {
      toast.error("Erro ao solicitar saque");
    } else {
      toast.success("Saque solicitado! Pagamento toda sexta-feira.");
      loadData();
    }
  };

  return (
    <div className="space-y-4">
      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Indique e Ganhe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ganhe <strong className="text-primary">30% de comissão</strong> sobre o lucro de cada depósito dos seus indicados!
          </p>
          <p className="text-xs text-muted-foreground">
            💰 Pagamentos processados toda <strong>sexta-feira</strong>.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={profile?.referral_code ? `${window.location.origin}?ref=${profile.referral_code}` : "Carregando..."}
              className="text-xs"
            />
            <Button variant="outline" size="icon" onClick={copyReferralLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm font-medium text-foreground">
            Indicados: <strong>{referralCount}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Balance */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className="text-xl font-bold text-primary">{formatBRL(Math.max(0, availableCents))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-xl font-bold text-yellow-500">{formatBRL(pendingCents)}</p>
          </CardContent>
        </Card>
      </div>

      {/* PIX Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chave PIX para Saque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Chave PIX (CPF, email, telefone ou aleatória)</Label>
            <Input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Sua chave PIX"
            />
          </div>
          <Button onClick={savePixKey} disabled={savingPix} variant="secondary" className="w-full">
            {savingPix ? "Salvando..." : "Salvar chave PIX"}
          </Button>
        </CardContent>
      </Card>

      {/* Withdraw */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Solicitar Saque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Saques são processados toda <strong>sexta-feira</strong>. Valor mínimo: R$ 5,00.
            </p>
          </div>
          <Button
            onClick={requestWithdrawal}
            disabled={requestingWithdrawal || availableCents < 500 || !profile?.pix_key}
            className="w-full"
          >
            {requestingWithdrawal ? "Solicitando..." : `Solicitar saque de ${formatBRL(Math.max(0, availableCents))}`}
          </Button>
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Saques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    {w.status === "paid" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatBRL(w.amount_cents)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={w.status === "paid" ? "default" : "secondary"}>
                    {w.status === "paid" ? "Pago" : w.status === "pending" ? "Pendente" : w.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commission History */}
      {commissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comissões Recebidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {commissions.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 border-b border-border last:border-0">
                  <p className="text-sm text-foreground">{formatBRL(c.commission_cents)}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === "pending" ? "secondary" : "default"} className="text-xs">
                      {c.status === "pending" ? "Pendente" : "Confirmado"}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
