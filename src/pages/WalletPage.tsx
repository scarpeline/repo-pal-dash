import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, QrCode, ArrowLeft, Clock, CheckCircle, XCircle, Package, Loader2, ExternalLink } from "lucide-react";
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
  checkout_url?: string | null;
  stripe_price_id?: string | null;
}

export default function WalletPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const goBack = onBack || (() => navigate("/"));
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [primaryGateway, setPrimaryGateway] = useState<"asaas" | "stripe">("asaas");
  const [pixData, setPixData] = useState<{ qr: string | null; copy: string | null; url: string | null } | null>(null);

  useEffect(() => {
    loadData();
    loadPackages();
  }, []);

  const loadPackages = async () => {
    const { data } = await supabase.from("packages").select("*").eq("is_active", true).order("price_brl");
    if (data) setPackages(data as any[]);

    const { data: settings } = await supabase.from("app_settings").select("*").eq("key", "primary_gateway").single();
    if (settings) setPrimaryGateway(settings.value as any);
  };

  const loadData = async () => {
    if (!session) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    try {
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
    } catch (e) {
      console.error("Erro ao carregar dados da carteira", e);
    }
  };

  const handleRecharge = async (amountInCents: number, packageId?: string) => {
    if (!session || !user) return;
    setLoading(true);
    setPixData(null);
    const pkg = packages.find((p) => p.id === packageId);

    if (pkg?.checkout_url) {
      setPixData({
        qr: null,
        copy: pkg.checkout_url,
        url: pkg.checkout_url,
      });
      setLoading(false);
      toast.info("Link de pagamento gerado!");
      return;
    }

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      
      // 2. Stripe Fallback Logic
      if (primaryGateway === "stripe") {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/stripe-payment?action=create-checkout`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              price_id: pkg?.stripe_price_id,
              package_id: packageId,
              amount_cents: amountInCents,
              credits: pkg?.credits_amount || amountInCents,
            }),
          }
        );
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error(data.error || "Erro ao iniciar Stripe");
      }

      // 3. Default Asaas (PIX) logic
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas-payment?action=create-pix`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount_cents: amountInCents,
            customer_email: user.email,
            customer_name: user.user_metadata?.full_name || user.email,
            package_id: packageId
          }),
        }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro na Function (${res.status}): ${errorText}`);
      }

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        setPixData({
          qr: data.pix_qr_code,
          copy: data.pix_copy_paste,
          url: data.invoice_url
        });
        toast.success("Pagamento gerado com sucesso!");
        loadData();
      }
    } catch (err: any) {
      console.error("Erro handleRecharge:", err);
      toast.error(err.message || "Erro ao conectar com o servidor de pagamentos");
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (pixData?.copy) {
      navigator.clipboard.writeText(pixData.copy);
      toast.success(pixData.qr ? "Código PIX copiado!" : "Link de checkout copiado!");
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
          <CardHeader><CardTitle className="text-lg">Saldo Atual</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {balance ? formatBRL(balance.balance_cents) : "R$ 0,00"}
            </p>
          </CardContent>
        </Card>

        {/* Packages Section */}
        {packages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5" /> Escolha um Pacote</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    disabled={loading}
                    onClick={() => handleRecharge(pkg.price_brl, pkg.id)}
                    className="border border-border rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50 group relative"
                  >
                    <p className="text-sm font-bold text-foreground">{pkg.name}</p>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>}
                    <div className="flex items-end justify-between mt-4">
                      <p className="text-xl font-bold text-primary">{formatBRL(pkg.price_brl)}</p>
                      <Badge variant="outline" className="text-[10px]">{pkg.credits_amount.toLocaleString()} crds</Badge>
                    </div>
                    {loading && <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg"><Loader2 className="w-5 h-5 animate-spin" /></div>}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg">Recarga Personalizada (PIX)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[1000, 2000, 3000, 5000, 10000].map(v => (
                <Button key={v} variant="outline" disabled={loading} onClick={() => handleRecharge(v)} className="text-sm font-semibold">
                  {formatBRL(v)}
                </Button>
              ))}
            </div>

            {pixData && (
              <div className="space-y-4 border-t border-border pt-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex justify-center">
                  <QrCode className="h-6 w-6 text-muted-foreground" />
                </div>

                <div className="flex flex-col items-center gap-4 rounded-lg bg-muted/30 px-4 py-6">
                  {pixData.qr ? (
                    <div className="rounded-lg border border-border bg-background p-2">
                      <img
                        src={`data:image/png;base64,${pixData.qr}`}
                        alt="QR Code PIX"
                        loading="lazy"
                        className="h-48 w-48 rounded-md"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-border bg-background">
                      <div className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
                        <QrCode className="h-10 w-10" />
                        <span>Link de pagamento pronto para abrir no navegador.</span>
                      </div>
                    </div>
                  )}

                  <div className="w-full max-w-sm space-y-2">
                    <Button variant="secondary" className="w-full" onClick={copyPix}>
                      {pixData.qr ? "Copiar código PIX" : "Copiar link de pagamento"}
                    </Button>
                    {pixData.url && (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => window.open(pixData.url!, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                        {pixData.qr ? "Pagar no checkout" : "Abrir checkout seguro"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Histórico de Transações</CardTitle></CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação registrada.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      {statusIcon(tx.status)}
                      <div>
                        <p className="text-sm font-medium text-foreground">{tx.description}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.type === "deposit" || tx.type === "commission" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                        {tx.type === "deposit" || tx.type === "commission" ? "+" : "-"}{formatBRL(tx.amount_cents)}
                      </p>
                      <Badge variant="outline" className="text-[9px] uppercase">{tx.status}</Badge>
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