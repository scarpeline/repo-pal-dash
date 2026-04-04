import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, QrCode, ArrowLeft, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const RECHARGE_VALUES = [700, 1000, 1500, 2000, 3000, 5000, 7000];

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function WalletPage({ onBack }: { onBack: () => void }) {
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr: string; copy: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!session) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    const [balRes, txRes] = await Promise.all([
      fetch(`https://${projectId}.supabase.co/functions/v1/asaas-payment?action=balance`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }),
      fetch(`https://${projectId}.supabase.co/functions/v1/asaas-payment?action=transactions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }),
    ]);

    const balData = await balRes.json();
    const txData = await txRes.json();
    setBalance(balData.balance);
    setTransactions(txData.transactions || []);
  };

  const handleRecharge = async (amountCents: number) => {
    if (!session || !user) return;
    setLoading(true);
    setPixData(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas-payment?action=create-pix`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount_cents: amountCents,
            customer_email: user.email,
            customer_name: user.user_metadata?.full_name || user.email,
          }),
        }
      );
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setPixData({ qr: data.pix_qr_code, copy: data.pix_copy_paste });
        toast.success("PIX gerado! Escaneie o QR Code ou copie o código.");
        loadData();
      }
    } catch {
      toast.error("Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (pixData?.copy) {
      navigator.clipboard.writeText(pixData.copy);
      toast.success("Código PIX copiado!");
    }
  };

  const statusIcon = (status: string) => {
    if (status === "confirmed") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Carteira
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {balance ? formatBRL(balance.balance_cents) : "R$ 0,00"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recarregar via PIX</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {RECHARGE_VALUES.map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  disabled={loading}
                  onClick={() => handleRecharge(v)}
                  className="text-sm font-semibold"
                >
                  {formatBRL(v)}
                </Button>
              ))}
            </div>

            {pixData && (
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex justify-center">
                  <QrCode className="h-6 w-6 text-muted-foreground" />
                </div>
                {pixData.qr && (
                  <div className="flex justify-center">
                    <img
                      src={`data:image/png;base64,${pixData.qr}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 rounded-lg border border-border"
                    />
                  </div>
                )}
                <Button variant="secondary" className="w-full" onClick={copyPix}>
                  Copiar código PIX
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      {statusIcon(tx.status)}
                      <div>
                        <p className="text-sm font-medium text-foreground">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.type === "deposit" || tx.type === "commission" ? "text-green-500" : "text-destructive"}`}>
                        {tx.type === "deposit" || tx.type === "commission" ? "+" : "-"}
                        {formatBRL(tx.amount_cents)}
                      </p>
                      <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
