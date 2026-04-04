import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Calculator, Bell, Send, DollarSign, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const RECHARGE_VALUES = [700, 1000, 1500, 2000, 3000, 5000, 7000];

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const { session } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [costPerReal, setCostPerReal] = useState("0.50");
  const [selectedUser, setSelectedUser] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
    loadWithdrawals();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, created_at, pix_key, referral_code");
    setUsers(data || []);
  };

  const loadWithdrawals = async () => {
    // Admin reads via service role in edge function - for now show from client
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-notification?action=withdrawals`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      const data = await res.json();
      setWithdrawals(data.withdrawals || []);
    } catch {
      // fallback
    }
  };

  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setSendingNotif(true);
    try {
      const targetUsers = selectedUser === "all"
        ? users.map(u => u.id)
        : [selectedUser];

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-notification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_ids: targetUsers,
            title: notifTitle,
            message: notifMessage,
          }),
        }
      );
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Notificação enviada para ${targetUsers.length} usuário(s)!`);
        setNotifTitle("");
        setNotifMessage("");
      }
    } catch {
      toast.error("Erro ao enviar notificação");
    } finally {
      setSendingNotif(false);
    }
  };

  const costFloat = parseFloat(costPerReal) || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
        </div>

        <Tabs defaultValue="calculator">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="calculator" className="gap-1 text-xs">
              <Calculator className="h-4 w-4" /> Calculadora
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1 text-xs">
              <Users className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-1 text-xs">
              <DollarSign className="h-4 w-4" /> Saques
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1 text-xs">
              <Bell className="h-4 w-4" /> Notificações
            </TabsTrigger>
          </TabsList>

          {/* Calculator Tab */}
          <TabsContent value="calculator" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Custo API vs Revenda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Custo da API por R$ 1,00 de crédito</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPerReal}
                    onChange={(e) => setCostPerReal(e.target.value)}
                    placeholder="Ex: 0.50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Quanto custa para você (API) cada R$ 1,00 vendido ao usuário
                  </p>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left text-foreground">Recarga</th>
                        <th className="p-3 text-right text-foreground">Custo API</th>
                        <th className="p-3 text-right text-foreground">Comissão 30%</th>
                        <th className="p-3 text-right text-foreground">Lucro Líq.</th>
                        <th className="p-3 text-right text-foreground">Margem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RECHARGE_VALUES.map((v) => {
                        const rechargeReal = v / 100;
                        const cost = rechargeReal * costFloat;
                        const grossProfit = rechargeReal - cost;
                        const affiliateComm = grossProfit * 0.3;
                        const netProfit = grossProfit - affiliateComm;
                        const margin = rechargeReal > 0 ? (netProfit / rechargeReal) * 100 : 0;
                        return (
                          <tr key={v} className="border-t border-border">
                            <td className="p-3 font-medium text-foreground">{formatBRL(v)}</td>
                            <td className="p-3 text-right text-destructive">
                              R$ {cost.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="p-3 text-right text-yellow-500">
                              R$ {affiliateComm.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="p-3 text-right text-green-500 font-semibold">
                              R$ {netProfit.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {margin.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    {(() => {
                      const totalCents = RECHARGE_VALUES.reduce((a, b) => a + b, 0);
                      const totalReal = totalCents / 100;
                      const totalCost = totalReal * costFloat;
                      const totalGross = totalReal - totalCost;
                      const totalComm = totalGross * 0.3;
                      const totalNet = totalGross - totalComm;
                      return (
                        <p className="text-sm text-muted-foreground">
                          <strong>Resumo (1x cada):</strong> Arrecada{" "}
                          <strong className="text-foreground">{formatBRL(totalCents)}</strong>
                          {" · "}Custo API{" "}
                          <strong className="text-destructive">R$ {totalCost.toFixed(2).replace(".", ",")}</strong>
                          {" · "}Comissão afiliado{" "}
                          <strong className="text-yellow-500">R$ {totalComm.toFixed(2).replace(".", ",")}</strong>
                          {" · "}Lucro líquido{" "}
                          <strong className="text-green-500">R$ {totalNet.toFixed(2).replace(".", ",")}</strong>
                        </p>
                      );
                    })()}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Usuários cadastrados ({users.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.full_name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                          {u.pix_key && (
                            <p className="text-xs text-muted-foreground">PIX: {u.pix_key}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("pt-BR")}
                          </p>
                          {u.referral_code && (
                            <Badge variant="outline" className="text-xs">{u.referral_code}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Solicitações de Saque</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma solicitação de saque.</p>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.map((w: any) => {
                      const userName = users.find(u => u.id === w.user_id)?.full_name || w.user_id;
                      return (
                        <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            {w.status === "paid" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground">{userName}</p>
                              <p className="text-xs text-muted-foreground">PIX: {w.pix_key}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(w.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{formatBRL(w.amount_cents)}</p>
                            <Badge variant={w.status === "paid" ? "default" : "secondary"}>
                              {w.status === "paid" ? "Pago" : "Pendente"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Enviar Notificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Destinatário</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o destinatário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="Título da notificação"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    placeholder="Escreva a mensagem..."
                    rows={4}
                  />
                </div>

                <Button
                  onClick={sendNotification}
                  disabled={sendingNotif || !selectedUser}
                  className="w-full gap-2"
                >
                  <Send className="h-4 w-4" />
                  {sendingNotif ? "Enviando..." : "Enviar notificação"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
