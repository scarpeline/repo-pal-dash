import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, QrCode, ArrowLeft, Clock, CheckCircle, XCircle,
  Package, Loader2, ExternalLink, CreditCard, MessageSquare,
  RefreshCw, Copy, Check, X
} from "lucide-react";
import { formatCreditsAsBRL } from "@/utils/credits";
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

interface PixData {
  qr: string | null;
  copy: string | null;
  url: string | null;
  payment_id?: string | null;
  amount_cents: number;
  package_name?: string;
}

export default function WalletPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goBack = onBack || (() => navigate("/"));
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null); // packageId or "custom"
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [primaryGateway, setPrimaryGateway] = useState<"asaas" | "stripe">("asaas");
  const [extensionWhatsappLink, setExtensionWhatsappLink] = useState("https://wa.me/5514991611225");
  const [extensionButtonEnabled, setExtensionButtonEnabled] = useState(true);
  const [extensionButtonText, setExtensionButtonText] = useState("🛒 Comprar Extensão/Licença");
  const [pixModal, setPixModal] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const pixPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  useEffect(() => {
    const successParam = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    const canceled = searchParams.get("canceled");
    if (canceled) { toast.error("Pagamento cancelado."); return; }
    if (successParam === "true" && sessionId) verifyStripeSession(sessionId);
  }, []);

  useEffect(() => {
    loadData();
    loadPackages();
    return () => { if (pixPollRef.current) clearInterval(pixPollRef.current); };
  }, []);

  const loadPackages = async () => {
    const { data } = await supabase.from("packages").select("*").eq("is_active", true).order("price_brl");
    if (data) setPackages(data as any[]);

    const { data: settings } = await supabase.from("app_settings").select("*").eq("key", "primary_gateway").single();
    if (settings) setPrimaryGateway(settings.value as any);

    const { data: ws } = await supabase.from("app_settings").select("*").in("key", [
      "extension_whatsapp_link", "extension_button_enabled", "extension_button_text"
    ]);
    ws?.forEach((s: any) => {
      if (s.key === "extension_whatsapp_link") setExtensionWhatsappLink(s.value);
      if (s.key === "extension_button_enabled") setExtensionButtonEnabled(s.value === "true");
      if (s.key === "extension_button_text") setExtensionButtonText(s.value);
    });
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
      setBalance((await balRes.json()).balance);
      setTransactions((await txRes.json()).transactions || []);
    } catch (e) { console.error(e); }
    setRefreshingBalance(false);
  };

  const verifyStripeSession = async (sessionId: string) => {
    if (!session) return;
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/stripe-payment?action=verify-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (data.paid) { toast.success("🎉 Pagamento confirmado! Saldo atualizado."); loadData(); }
    } catch (e) { console.error(e); }
  };

  const startPixPolling = (paymentId: string) => {
    if (pixPollRef.current) clearInterval(pixPollRef.current);
    let attempts = 0;
    pixPollRef.current = setInterval(async () => {
      if (++attempts > 60 || !session) { clearInterval(pixPollRef.current!); return; }
      try {
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas-payment?action=check-payment`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ payment_id: paymentId }),
        });
        const data = await res.json();
        if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
          clearInterval(pixPollRef.current!);
          setPaid(true);
          toast.success("🎉 Pagamento PIX confirmado! Saldo atualizado.");
          loadData();
        }
      } catch (_) {}
    }, 5000);
  };

  const handleBuy = async (pkg: PackageItem) => {
    if (!session || !user) return;
    setLoading(pkg.id);
    setPixModal(null);
    setPaid(false);
    if (pixPollRef.current) clearInterval(pixPollRef.current);

    try {
      // Checkout URL manual
      if (pkg.checkout_url) {
        window.open(pkg.checkout_url, "_blank");
        setLoading(null);
        return;
      }

      // Stripe
      if (primaryGateway === "stripe" && pkg.stripe_price_id) {
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/stripe-payment?action=create-checkout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ price_id: pkg.stripe_price_id, package_id: pkg.id, amount_cents: pkg.price_brl, credits: pkg.credits_amount }),
        });
        const data = await res.json();
        if (data.url) { window.location.href = data.url; return; }
        throw new Error(data.error || "Erro Stripe");
      }

      // Asaas PIX
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas-payment?action=create-pix`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: pkg.price_brl,
          customer_email: user.email,
          customer_name: user.user_metadata?.full_name || user.email,
          package_id: pkg.id,
        }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPixModal({
        qr: data.pix_qr_code,
        copy: data.pix_copy_paste,
        url: data.invoice_url,
        payment_id: data.payment_id,
        amount_cents: pkg.price_brl,
        package_name: pkg.name,
      });

      if (data.payment_id) startPixPolling(data.payment_id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar pagamento");
    }
    setLoading(null);
  };

  const handleCustomPix = async (amountCents: number) => {
    if (!session || !user) return;
    setLoading("custom");
    setPixModal(null);
    setPaid(false);
    if (pixPollRef.current) clearInterval(pixPollRef.current);

    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas-payment?action=create-pix`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: amountCents, customer_email: user.email, customer_name: user.user_metadata?.full_name || user.email }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPixModal({
        qr: data.pix_qr_code,
        copy: data.pix_copy_paste,
        url: data.invoice_url,
        payment_id: data.payment_id,
        amount_cents: amountCents,
        package_name: `Recarga ${formatBRL(amountCents)}`,
      });

      if (data.payment_id) startPixPolling(data.payment_id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX");
    }
    setLoading(null);
  };

  const copyPix = async () => {
    if (!pixModal?.copy) return;
    await navigator.clipboard.writeText(pixModal.copy);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  const closeModal = () => {
    setPixModal(null);
    setPaid(false);
    if (pixPollRef.current) clearInterval(pixPollRef.current);
  };

  const statusIcon = (status: string) => {
    if (status === "confirmed") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Carteira</h1>
          <div className="ml-auto">
            <Button variant="ghost" size="icon" onClick={loadData} disabled={refreshingBalance}>
              <RefreshCw className={`h-4 w-4 ${refreshingBalance ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Saldo */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Saldo disponível</p>
            <p className="text-4xl font-bold text-primary">
              {balance ? formatBRL(balance.balance_cents) : "R$ 0,00"}
            </p>
          </CardContent>
        </Card>

        {/* Modal PIX inline */}
        {pixModal && (
          <Card className={`border-2 ${paid ? "border-green-500 bg-green-500/5" : "border-primary/40 bg-primary/5"} relative`}>
            <button onClick={closeModal} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {paid ? (
                  <><CheckCircle className="w-5 h-5 text-green-500" /> Pagamento Confirmado!</>
                ) : (
                  <><QrCode className="w-5 h-5 text-primary" /> Pague com PIX — {pixModal.package_name}</>
                )}
              </CardTitle>
              <p className="text-2xl font-bold text-primary">{formatBRL(pixModal.amount_cents)}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {paid ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-green-600">Saldo adicionado com sucesso!</p>
                  <Button className="mt-4" onClick={closeModal}>Fechar</Button>
                </div>
              ) : (
                <>
                  {/* QR Code */}
                  <div className="flex justify-center">
                    {pixModal.qr ? (
                      <img
                        src={`data:image/png;base64,${pixModal.qr}`}
                        alt="QR Code PIX"
                        className="w-52 h-52 rounded-xl border-4 border-white shadow-lg"
                      />
                    ) : pixModal.url ? (
                      <div className="bg-white p-3 rounded-xl shadow-lg">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixModal.url)}`}
                          alt="QR Code"
                          className="w-48 h-48"
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Instruções */}
                  <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                    <p>1. Abra o app do seu banco</p>
                    <p>2. Escolha pagar com PIX → QR Code ou Copia e Cola</p>
                    <p>3. Escaneie o QR Code ou cole o código abaixo</p>
                    <p>4. Confirme o pagamento — o saldo é creditado automaticamente</p>
                  </div>

                  {/* Botões */}
                  <div className="space-y-2">
                    {pixModal.copy && (
                      <Button className="w-full gap-2" onClick={copyPix} variant={copied ? "outline" : "default"}>
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? "Copiado!" : "Copiar código PIX (Copia e Cola)"}
                      </Button>
                    )}
                    {pixModal.url && (
                      <Button variant="outline" className="w-full gap-2" onClick={() => window.open(pixModal.url!, "_blank")}>
                        <ExternalLink className="w-4 h-4" /> Abrir fatura no Asaas
                      </Button>
                    )}
                  </div>

                  {/* Status polling */}
                  {pixModal.payment_id && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Aguardando confirmação do pagamento...
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

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
                    disabled={!!loading}
                    onClick={() => handleBuy(pkg)}
                    className={`border rounded-xl p-4 text-left transition-all relative group
                      ${pixModal && !paid ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-primary/5"}
                      disabled:opacity-50`}
                  >
                    <p className="font-bold text-foreground">{pkg.name}</p>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pkg.description}</p>}
                    <div className="flex items-end justify-between mt-3">
                      <p className="text-xl font-bold text-primary">{formatBRL(pkg.price_brl)}</p>
                      <Badge variant="outline" className="text-[10px]">{formatCreditsAsBRL(pkg.credits_amount)}</Badge>
                    </div>
                    {loading === pkg.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}
                    {pkg.checkout_url && <span className="absolute top-2 right-2 text-[9px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">Link</span>}
                    {pkg.stripe_price_id && !pkg.checkout_url && <span className="absolute top-2 right-2 text-[9px] bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5">Stripe</span>}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t space-y-2">
                {extensionButtonEnabled && (
                  <Button variant="outline" className="w-full gap-2 border-blue-500/30 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    onClick={() => window.open(extensionWhatsappLink, "_blank")}>
                    <ExternalLink className="h-4 w-4" /> {extensionButtonText}
                  </Button>
                )}
                <Button variant="ghost" className="w-full gap-2 text-muted-foreground"
                  onClick={() => window.open("https://w.app/o-scarpeline", "_blank")}>
                  <MessageSquare className="h-4 w-4" /> Falar com responsável
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recarga personalizada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recarga Personalizada (PIX)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[1000, 2000, 3000, 5000, 10000].map((v) => (
                <Button key={v} variant="outline" disabled={!!loading} onClick={() => handleCustomPix(v)} className="font-semibold">
                  {loading === "custom" ? <Loader2 className="w-4 h-4 animate-spin" /> : formatBRL(v)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Histórico</CardTitle></CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação registrada.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      {statusIcon(tx.status)}
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.type === "deposit" || tx.type === "commission" ? "text-green-500" : "text-destructive"}`}>
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
