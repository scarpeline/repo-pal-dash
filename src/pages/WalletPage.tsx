import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet, QrCode, ArrowLeft, CheckCircle,
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
  const [cpf, setCpf] = useState("");
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const pixPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Cartão de crédito
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardAmount, setCardAmount] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCpf, setCardCpf] = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const [cardPaid, setCardPaid] = useState(false);

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
          customer_cpf: cpf.replace(/\D/g, "") || undefined,
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
        body: JSON.stringify({ amount_cents: amountCents, customer_email: user.email, customer_name: user.user_metadata?.full_name || user.email, customer_cpf: cpf.replace(/\D/g, "") || undefined }),
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

  const handleCardPayment = async () => {
    if (!session || !user) return;
    const amountCents = Math.round(parseFloat(cardAmount.replace(",", ".")) * 100);
    if (!amountCents || amountCents < 500) { toast.error("Valor mínimo: R$ 5,00"); return; }
    if (!cardName.trim()) { toast.error("Informe o nome no cartão"); return; }
    if (cardNumber.replace(/\s/g, "").length < 16) { toast.error("Número do cartão inválido"); return; }
    if (!cardExpiry.includes("/") || cardExpiry.length < 5) { toast.error("Validade inválida (MM/AA)"); return; }
    if (cardCvv.length < 3) { toast.error("CVV inválido"); return; }
    const cpfClean = cardCpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) { toast.error("CPF obrigatório para pagamento com cartão"); return; }

    setCardLoading(true);
    try {
      // Tokenizar cartão via Asaas (sandbox ou produção)
      const asaasMode = "sandbox"; // troque para "production" em produção
      const asaasTokenUrl = asaasMode === "sandbox"
        ? "https://sandbox.asaas.com/api/v3/creditCard/tokenize"
        : "https://api.asaas.com/v3/creditCard/tokenize";

      // Tokenização via edge function para não expor a API key no frontend
      const tokenRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas-payment?action=tokenize-card`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: cardName,
            customer_cpf: cpfClean,
            card_number: cardNumber.replace(/\s/g, ""),
            card_expiry_month: cardExpiry.split("/")[0],
            card_expiry_year: "20" + cardExpiry.split("/")[1],
            card_cvv: cardCvv,
            card_holder_name: cardName,
          }),
        }
      );

      const tokenData = await tokenRes.json();
      if (tokenData.error || !tokenData.card_token) {
        throw new Error(tokenData.error || "Erro ao tokenizar cartão");
      }

      // Cobrar com o token
      const payRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas-payment?action=create-card`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            amount_cents: amountCents,
            customer_name: cardName,
            customer_cpf: cpfClean,
            card_token: tokenData.card_token,
          }),
        }
      );

      const payData = await payRes.json();
      if (payData.error) throw new Error(payData.error);

      if (payData.status === "CONFIRMED") {
        setCardPaid(true);
        toast.success("🎉 Pagamento confirmado! Saldo adicionado.");
        loadData();
      } else {
        toast.info("Pagamento em processamento. Aguarde a confirmação.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro no pagamento com cartão");
    }
    setCardLoading(false);
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
    return null;
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

        {/* CPF opcional para PIX */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs text-muted-foreground block mb-1">CPF (opcional — melhora a emissão do PIX)</label>
            <input
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              maxLength={14}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                setCpf(v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
              }}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </CardContent>
        </Card>

        {/* Formulário de Cartão de Crédito */}
        <Card>
          <CardHeader className="pb-2">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => { setShowCardForm(!showCardForm); setCardPaid(false); }}
            >
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Pagar com Cartão de Crédito
              </CardTitle>
              <span className="text-xs text-muted-foreground">{showCardForm ? "▲ Fechar" : "▼ Abrir"}</span>
            </button>
          </CardHeader>

          {showCardForm && (
            <CardContent className="space-y-3 pt-0">
              {cardPaid ? (
                <div className="text-center py-6">
                  <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-green-600">Pagamento confirmado!</p>
                  <p className="text-sm text-muted-foreground mt-1">Saldo adicionado com sucesso.</p>
                  <Button className="mt-4" onClick={() => { setShowCardForm(false); setCardPaid(false); }}>Fechar</Button>
                </div>
              ) : (
                <>
                  {/* Vendedor */}
                  <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Vendedor:</span>
                    <span className="text-xs font-semibold text-foreground">IA Programador</span>
                  </div>

                  {/* Valor */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Valor (R$) *</label>
                    <input
                      type="text"
                      placeholder="Ex: 30,00"
                      value={cardAmount}
                      onChange={(e) => setCardAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Nome no cartão */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Nome no cartão *</label>
                    <input
                      type="text"
                      placeholder="NOME SOBRENOME"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Número do cartão */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Número do cartão *</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      maxLength={19}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                        setCardNumber(v.replace(/(\d{4})(?=\d)/g, "$1 "));
                      }}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono tracking-widest"
                    />
                  </div>

                  {/* Validade + CVV */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Validade (MM/AA) *</label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        maxLength={5}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setCardExpiry(v.length > 2 ? v.slice(0, 2) + "/" + v.slice(2) : v);
                        }}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">CVV *</label>
                      <input
                        type="text"
                        placeholder="000"
                        value={cardCvv}
                        maxLength={4}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* CPF */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">CPF do titular *</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={cardCpf}
                      maxLength={14}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setCardCpf(v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
                      }}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={handleCardPayment}
                    disabled={cardLoading}
                  >
                    {cardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {cardLoading ? "Processando..." : `Pagar ${cardAmount ? `R$ ${cardAmount}` : ""}`}
                  </Button>

                  <p className="text-[10px] text-muted-foreground text-center">
                    🔒 Pagamento seguro via Asaas · Dados criptografados
                  </p>
                </>
              )}
            </CardContent>
          )}
        </Card>

        {/* Pacotes + Recarga unificados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Adicionar saldo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Pacotes minimalistas */}
            {packages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium px-1">Pacotes</p>
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    disabled={!!loading}
                    onClick={() => handleBuy(pkg)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 relative"
                  >
                    <span className="text-sm text-foreground">{pkg.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">{formatBRL(pkg.price_brl)}</span>
                      {loading === pkg.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Divisor */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-3 text-[11px] text-muted-foreground">ou valor personalizado</span></div>
            </div>

            {/* Campo de valor livre para PIX */}
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium px-1">PIX — valor à sua escolha</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    id="custom-pix-amount"
                    className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => {
                      // Permite apenas números e vírgula
                      e.target.value = e.target.value.replace(/[^0-9,]/g, "");
                    }}
                  />
                </div>
                <Button
                  disabled={!!loading}
                  onClick={() => {
                    const input = document.getElementById("custom-pix-amount") as HTMLInputElement;
                    const val = parseFloat((input?.value || "0").replace(",", "."));
                    if (!val || val < 5) { toast.error("Valor mínimo: R$ 5,00"); return; }
                    handleCustomPix(Math.round(val * 100));
                  }}
                  className="gap-1.5 shrink-0"
                >
                  {loading === "custom" ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Gerar PIX
                </Button>
              </div>
            </div>

            {/* Links extras */}
            <div className="pt-1 border-t flex flex-col gap-0.5">
              {extensionButtonEnabled && (
                <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground justify-start text-xs h-8"
                  onClick={() => window.open(extensionWhatsappLink, "_blank")}>
                  <ExternalLink className="h-3 w-3" /> {extensionButtonText}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground justify-start text-xs h-8"
                onClick={() => window.open("https://w.app/o-scarpeline", "_blank")}>
                <MessageSquare className="h-3 w-3" /> Falar com responsável
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* Histórico — apenas depósitos confirmados */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Histórico</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const confirmed = transactions.filter(tx => tx.type === "deposit" && tx.status === "confirmed");
              return confirmed.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum depósito confirmado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {confirmed.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-BR")}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-green-500">+{formatBRL(tx.amount_cents)}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
