import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Send, Loader2, Mail, Users, CheckCircle, XCircle,
  Eye, FileText, Sparkles, TrendingUp, Bell, Copy, Check
} from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  description: string;
  subject: string;
  html_content: string;
  category: string;
}

interface Campaign {
  id: string;
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  test_mode: boolean;
  created_at: string;
  completed_at: string | null;
}

export default function EmailCampaignPage() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [fromName, setFromName] = useState("IAProgramador");
  const [fromEmail, setFromEmail] = useState("noreply@iaprogramador.online");
  const [recipientFilter, setRecipientFilter] = useState<string>("all");
  const [customEmails, setCustomEmails] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  useEffect(() => {
    loadTemplates();
    loadCampaigns();
    updateRecipientCount();
  }, []);

  useEffect(() => {
    updateRecipientCount();
  }, [recipientFilter]);

  const loadTemplates = async () => {
    const { data } = await (supabase as any)
      .from("email_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");
    
    if (data) setTemplates(data as Template[]);
  };

  const loadCampaigns = async () => {
    if (!session) return;
    
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-email-campaign?action=list`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      
      const data = await res.json();
      if (data.campaigns) setCampaigns(data.campaigns);
    } catch (err) {
      console.error("Error loading campaigns:", err);
    }
  };

  const updateRecipientCount = async () => {
    if (!session) return;
    setCountLoading(true);
    
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-email-campaign?action=count&filter=${recipientFilter}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      
      const data = await res.json();
      setRecipientCount(data.count || 0);
    } catch (err) {
      console.error("Error counting recipients:", err);
    }
    
    setCountLoading(false);
  };

  const handleTemplateSelect = (template: Template) => {
    setSubject(template.subject);
    setHtmlContent(template.html_content);
    setTextContent((template as any).text_content || "");
    toast.success(`Template "${template.name}" carregado!`);
  };

  const handleSendCampaign = async () => {
    if (!session) return;
    
    if (!subject.trim() || !htmlContent.trim()) {
      toast.error("Preencha o assunto e o conteúdo do email");
      return;
    }

    if (recipientFilter === "custom" && !customEmails.trim()) {
      toast.error("Informe os emails dos destinatários");
      return;
    }

    const confirmMsg = testMode
      ? "Enviar email de teste para você?"
      : `Enviar campanha para ${recipientCount} destinatários?`;
    
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    
    try {
      const payload: any = {
        subject,
        html_content: htmlContent,
        text_content: textContent,
        from_name: fromName,
        from_email: fromEmail,
        recipient_filter: recipientFilter,
        test_mode: testMode,
      };

      if (recipientFilter === "custom") {
        payload.custom_emails = customEmails
          .split(/[\n,;]/)
          .map(e => e.trim())
          .filter(e => e.includes("@"));
      }

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-email-campaign?action=send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Erro ao enviar campanha");

      toast.success(
        `✅ Campanha enviada! ${data.results.sent} emails enviados, ${data.results.failed} falharam.`
      );
      
      loadCampaigns();
      
      // Limpar formulário
      if (!testMode) {
        setSubject("");
        setHtmlContent("");
        setTextContent("");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar campanha");
    }
    
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const filterOptions = [
    { value: "all", label: "Todos os usuários", icon: Users },
    { value: "paid", label: "Usuários pagantes", icon: CheckCircle },
    { value: "unpaid", label: "Usuários não pagantes", icon: XCircle },
    { value: "active", label: "Ativos (últimos 30 dias)", icon: TrendingUp },
    { value: "inactive", label: "Inativos (30+ dias)", icon: Bell },
    { value: "custom", label: "Lista personalizada", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" /> Campanhas de Email
            </h1>
            <p className="text-sm text-muted-foreground">Envie emails para seus assinantes</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Formulário de Envio */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Templates Prontos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="p-3 text-left border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <p className="font-semibold text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Configurações do Email */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configurações do Email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Remetente */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Nome do remetente</label>
                    <Input
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="IAProgramador"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Email do remetente</label>
                    <Input
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="noreply@iaprogramador.online"
                    />
                  </div>
                </div>

                {/* Assunto */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Assunto *</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: 🚀 Novidades no IAProgramador!"
                  />
                </div>

                {/* Conteúdo HTML */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Conteúdo HTML * 
                    <span className="ml-2 text-primary">{"Use {{name}} e {{email}} para personalizar"}</span>
                  </label>
                  <Textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    placeholder="<h1>Olá {{name}}!</h1><p>Conteúdo do email...</p>"
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>

                {/* Conteúdo Texto */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Conteúdo Texto (opcional)</label>
                  <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Versão em texto puro do email..."
                    rows={4}
                  />
                </div>

                {/* Preview */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? "Ocultar Preview" : "Ver Preview"}
                </Button>

                {showPreview && (
                  <div className="border border-border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">PREVIEW</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(htmlContent)}
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <div
                      className="bg-white p-4 rounded border"
                      dangerouslySetInnerHTML={{
                        __html: htmlContent
                          .replace(/\{\{name\}\}/g, "João Silva")
                          .replace(/\{\{email\}\}/g, user?.email || "usuario@exemplo.com"),
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Destinatários e Envio */}
          <div className="space-y-6">
            
            {/* Destinatários */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Destinatários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                
                {/* Filtro */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Selecionar público</label>
                  <div className="space-y-1">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setRecipientFilter(option.value)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-all ${
                          recipientFilter === option.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/70"
                        }`}
                      >
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista personalizada */}
                {recipientFilter === "custom" && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Emails (um por linha)
                    </label>
                    <Textarea
                      value={customEmails}
                      onChange={(e) => setCustomEmails(e.target.value)}
                      placeholder="email1@exemplo.com&#10;email2@exemplo.com"
                      rows={5}
                      className="text-xs"
                    />
                  </div>
                )}

                {/* Contador */}
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {countLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : recipientCount}
                  </p>
                  <p className="text-xs text-muted-foreground">destinatários</p>
                </div>

                {/* Modo teste */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Modo teste (enviar apenas para mim)</span>
                </label>

                {/* Botão de envio */}
                <Button
                  className="w-full gap-2"
                  onClick={handleSendCampaign}
                  disabled={loading || recipientCount === 0}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {testMode ? "Enviar Teste" : `Enviar para ${recipientCount}`}
                </Button>
              </CardContent>
            </Card>

            {/* Histórico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma campanha enviada ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {campaigns.slice(0, 5).map((campaign) => (
                      <div
                        key={campaign.id}
                        className="p-2 border border-border rounded-lg text-xs"
                      >
                        <p className="font-semibold truncate">{campaign.subject}</p>
                        <div className="flex items-center justify-between mt-1 text-muted-foreground">
                          <span>
                            {campaign.sent_count}/{campaign.recipient_count} enviados
                          </span>
                          <span className={`px-2 py-0.5 rounded ${
                            campaign.status === "completed" ? "bg-green-500/10 text-green-600" :
                            campaign.status === "sending" ? "bg-blue-500/10 text-blue-600" :
                            "bg-gray-500/10 text-gray-600"
                          }`}>
                            {campaign.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
