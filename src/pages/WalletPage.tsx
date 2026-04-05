import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, QrCode, ArrowLeft, Clock, CheckCircle, XCircle, Package, Loader2, ExternalLink } from "lucide-react";
import { formatCredits } from "@/utils/credits";
import { toast } from "sonner";

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

interface PackageItem {
  id: string; 
  name: string; 
  description: string | null;
  credits_amount: number; 
  price_brl: number;
}

export default function WalletPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const goBack = onBack || (() => navigate("/"));
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr: string | null; copy: string | null; url: string | null } | null>(null);

  useEffect(() => {
    loadData();
    loadPackages();
  }, []);

  const loadPackages = async () => {
    const { data } = await supabase.from("packages").select("*").eq("is_active", true).order("price_brl");
    if (data) setPackages(data as any[]);
  };

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

  const handleRecharge = async (amountInBrlOrCents: number, packageId?: string) => {
    if (!session || !user) return;
    setLoading(true);
    setPixData(null);
    
    // Se vier de um pacote, o price_brl na tabela está em centavos (ex: 1000 para R$10).
    // Se vier do botão de recarga rápida, o valor também é passado em centavos no componente atual.
    const amountCents = amountInBrlOrCents;

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
            package_id: packageId
          }),
        }
      );
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Erro de infraestrutura (Edge Function): " + text.slice(0, 50));
      }

      if (data.error) {
        toast.error(data.error);
      } else {
        setPixData({ 
          qr: data.pix_qr_code, 
          copy: data.pix_copy_paste,
          url: data.invoice_url 
        });
        toast.success("Pagamento gerado!");
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX");
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
    if (status === "confirmed") return <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Carteira
          </h1>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Saldo</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {balance ? formatBRL(balance.balance_cents) : "R$ 0,00"}
            </p>
          </CardContent>
        </Card>

        {/* Packages from Admin */}
        {packages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5" /> Pacotes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    disabled={loading}
                    onClick={() => handleRecharge(pkg.price_brl, pkg.id)}
                    className="border border-border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
                  >
                    <p className="text-sm font-bold text-foreground">{pkg.name}</p>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-0.5">{pkg.description}</p>}
                    <p className="text-lg font-bold text-primary mt-1">{formatBRL(pkg.price_brl)}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg">Recarga rápida via PIX</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {[1000, 1500, 2000, 2500, 3000, 5000, 7000, 10000, 15000, 20000].map(v => (
                <Button key={v} variant="outline" disabled={loading} onClick={() => handleRecharge(v)} className="text-sm font-semibold">
                  {formatBRL(v)}
                </Button>
              ))}
            </div>

            {pixData && (
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex justify-center"><QrCode className="h-6 w-6 text-muted-foreground" /></div>
                {pixData.qr && (
                  <div className="flex justify-center flex-col items-center gap-3">
                    <img src={`data:image/png;base64,${pixData.qr}`} alt="QR Code PIX" className="w-48 h-48 rounded-lg border border-border" />
                    <Button variant="secondary" className="w-full" onClick={copyPix}>Copiar código PIX</Button>
                  </div>
                )}
                
                {pixData.url && (
                  <div className="pt-2">
                    <p className="text-xs text-center text-muted-foreground mb-2">Problemas com o QR Code?</p>
                    <Button variant="outline" className="w-full gap-2" onClick={() => window.open(pixData.url!, "_blank")}>
                      <ExternalLink className="w-4 h-4" /> Pagar no Checkout Asaas
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Histórico</CardTitle></CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      {statusIcon(tx.status)}
                      <div>
                        <p className="text-sm font-medium text-foreground">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.type === "deposit" || tx.type === "commission" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                        {tx.type === "deposit" || tx.type === "commission" ? "+" : "-"}{formatBRL(tx.amount_cents)}
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