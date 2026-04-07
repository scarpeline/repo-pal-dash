import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, QrCode, ArrowLeft, Clock, CheckCircle, XCircle,
  Package, Loader2, ExternalLink, CreditCard, MessageSquare, RefreshCw
} from "lucide-react";
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
  checkout_url?: string;
  stripe_price_id?: string;
  asaas_payment_link_id?: string;
}

export default function WalletPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goBack = onBack || (() => navigate("/"));
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [primaryGateway, setPrimaryGateway] = useState<"asaas" | "stripe">("asaas");
  const [pixData, setPixData] = useState<{
    qr: string | null;
    copy: string | null;
    url: string | null;
    payment_id?: string | null;
  } | null>(null);
  const pixPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Verificar sucesso/cancelamento de checkout Stripe ao voltar
  useEffect(() => {
    const successParam = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    const canceled = searchParams.get("canceled");

    if (canceled) {
      toast.error("Pagamento cancelado.");
      return;
    }

    if (successParam === "true" && sessionId) {
      verifyStripeSession(sessionId);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadPackages();
    return () => {
      if (pixPollRef.current) clearInterval(pixPollRef.current);
    };
  }, []);

  const loadPackages = async () => {
    const { data } = await supabase
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("price_brl");
    if (data) setPackages(data as any[]);

    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .eq("key", "primary_gateway")
      .single();
    if (settings) setPrimaryGateway(settings.value as any);
  };

  const loadData = async () => {
    if (!session) return;
    setRefreshingBalance(true);
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
    } finally {
      setRefreshingBalance(false);
    }
  };

  const verifyStripeSession = async (sessionId: string) => {
    if (!session) return;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/stripe-payment?action=verify-session`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ session_id: sessionId }),
        }
      );
      const data = await res.json();
      if (data.paid) {
        toast.success("🎉 Pagamento confirmado! Seu saldo foi atualizado.");
        loadData();
      }
    } catch (e) {
      console.error("Erro ao verificar sessão Stripe", e);
    }
  };

  const startPixPolling = (paymentId: string) => {
    if (pixPollRef.current) clearInterval(pixPollRef.current);
    let attempts = 0;
    const maxAttempts = 60; // 5 min

    pixPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pixPollRef.current!);
        return;
      }
      if (!session) return;
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/asaas-payment?action=check-payment`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payment_id: paymentId }),
          }
        );
        const data = await res.json();
        if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
          clearInterval(pixPollRef.current!);
          toast.success("🎉 Pagamento PIX confirmado! Saldo atualizado.");
          setPixData(null);
          loadData();
        }
      } catch (e) {
        // silently ignore polling errors
      }
    }, 5000); // poll a cada 5 segundos
  };

  const handleRecharge = async (amountInCents: number, packageId?: string) => {
    if (!session || !user) return;
    setLoading(true);
    setPixData(null);
    if (pixPollRef.current) clearInterval(pixPollRef.current);

    const pkg = packages.find((p) => p.id === packageId);

    // 1. Link de checkout manual (Asaas Link externo definido no admin)
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
      // 2. Stripe — se for o gateway primário e o pacote tiver price_id
      if (primaryGateway === "stripe") {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/stripe-payment?action=create-checkout`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              price_id: pkg?.stripe_price_id || undefined,
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
        throw new Error(data.error || "Erro ao iniciar checkout Stripe");
      }

      // 3. Asaas — PIX dinâmico (padrão)
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
            package_id: packageId,
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
          url: data.invoice_url,
          payment_id: data.payment_id,
        });
        toast.success("QR Code PIX gerado! Aguardando pagamento...");
        loadData();
        if (data.payment_id) {
          startPixPolling(data.payment_id);
        }
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
    if (status === "confirmed") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const gatewayBadge = (gateway: string) => {
    if (gateway === "stripe")
      return <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">Stripe</Badge>;
    if (gateway === "asaas")
      return <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Asaas</Badge>;
    return null;
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
          <div className="ml-auto">
            <Button variant="ghost" size="icon" onClick={loadData} disabled={refreshingBalance}>
              <RefreshCw className={`h-4 w-4 ${refreshingBalance ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Gateway Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Gateway ativo:</span>
          {primaryGateway === "stripe" ? (
            <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
              <CreditCard className="h-3 w-3" /> Stripe (Cartão Internacional)
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
              <QrCode className="h-3 w-3" /> Asaas (PIX / Boleto)
            </Badge>
          )}
        </div>

        {/* Saldo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldo Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {balance ? formatBRL(balance.balance_cents) : "R$ 0,00"}
            </p>
            {balance && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCredits(balance.balance_cents)} créditos disponíveis
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pacotes */}
        {packages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" /> Escolha um Pacote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    disabled={loading}
                    onClick={() => handleRecharge(pkg.price_brl, pkg.id)}
                    className="border border-border rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50 group relative"
                  >
                    <p className="text-sm font-bold text-foreground">{pkg.name}</p>
                    {pkg.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pkg.description}</p>
                    )}
                    <div className="flex items-end justify-between mt-4">
                      <p className="text-xl font-bold text-primary">{formatBRL(pkg.price_brl)}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {pkg.credits_amount.toLocaleString("pt-BR")} crds
                      </Badge>
                    </div>
                    {pkg.checkout_url && (
                      <span className="absolute top-2 right-2 text-[9px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">
                        Link
                      </span>
                    )}
                    {pkg.stripe_price_id && !pkg.checkout_url && (
                      <span className="absolute top-2 right-2 text-[9px] bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5">
                        Stripe
                      </span>
                    )}
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-green-500/30 hover:bg-green-500/10 hover:border-green-500 text-green-600 dark:text-green-400"
                  onClick={() => window.open("https://w.app/o-scarpeline", "_blank")}
                >
                  <MessageSquare className="h-4 w-4" /> Falar com responsável
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recarga via PIX avulso */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {primaryGateway === "stripe" ? "Recarga Personalizada (Stripe)" : "Recarga Personalizada (PIX)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[1000, 2000, 3000, 5000, 10000].map((v) => (
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

            {/* Exibição do PIX / Link */}
            {pixData && (
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex justify-center">
                  <QrCode className="h-6 w-6 text-muted-foreground" />
                </div>

                {pixData.payment_id && (
                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verificando pagamento automaticamente...
                  </div>
                )}

                <div className="flex justify-center flex-col items-center gap-3">
                  {pixData.qr ? (
                    <img
                      src={`data:image/png;base64,${pixData.qr}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 rounded-lg border border-border"
                    />
                  ) : pixData.url ? (
                    <div className="bg-white p-2 rounded-lg border border-border">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixData.url)}`}
                        alt="QR Code Checkout"
                        className="w-40 h-40"
                      />
                    </div>
                  ) : null}

                  <div className="w-full space-y-2">
                    <Button variant="secondary" className="w-full" onClick={copyPix}>
                      {pixData.qr ? "Copiar código PIX" : "Copiar Link de Pagamento"}
                    </Button>

                    {pixData.url && (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => window.open(pixData.url!, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                        {pixData.qr ? "Pagar no Checkout Asaas" : "Ir para Checkout Seguro"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma transação registrada.
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(tx.status)}
                      <div>
                        <p className="text-sm font-medium text-foreground">{tx.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString("pt-BR")}
                          </p>
                          {gatewayBadge(tx.payment_gateway)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          tx.type === "deposit" || tx.type === "commission"
                            ? "text-green-500"
                            : "text-destructive"
                        }`}
                      >
                        {tx.type === "deposit" || tx.type === "commission" ? "+" : "-"}
                        {formatBRL(tx.amount_cents)}
                      </p>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {tx.status}
                      </Badge>
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