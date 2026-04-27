import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Crown, Save, X, Plus, Trash2, Loader2, TrendingUp } from "lucide-react";

interface VIPUser {
  id: string;
  email: string;
  full_name: string | null;
  is_vip: boolean;
  vip_markup_percent: number;
  vip_notes: string | null;
  balance_cents: number;
  total_spent_cents: number;
  total_deposited_cents: number;
}

export default function SuperAdminVIPTab() {
  const [vipUsers, setVipUsers] = useState<VIPUser[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<VIPUser | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [addMode, setAddMode] = useState<"select" | "email">("select");
  const [markupPercent, setMarkupPercent] = useState("0");
  const [notes, setNotes] = useState("");
  
  // Configurações globais
  const [defaultMarkup, setDefaultMarkup] = useState("100");
  const [freeTrialCredits, setFreeTrialCredits] = useState("1000");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Carregar usuários VIP
    const { data: vipData } = await (supabase as any)
      .from("profiles")
      .select(`
        id, email, full_name, is_vip, vip_markup_percent, vip_notes,
        balances(balance_cents, total_spent_cents, total_deposited_cents)
      `)
      .eq("is_vip", true);
    
    if (vipData) {
      setVipUsers(vipData.map((u: any) => ({
        ...u,
        balance_cents: u.balances?.balance_cents || 0,
        total_spent_cents: u.balances?.total_spent_cents || 0,
        total_deposited_cents: u.balances?.total_deposited_cents || 0,
      })));
    }
    
    // Carregar todos os usuários para o select
    const { data: allData } = await (supabase as any)
      .from("profiles")
      .select("id, email, full_name, is_vip")
      .order("email");
    
    if (allData) setAllUsers(allData);
    
    // Carregar configurações
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["default_markup_percent", "free_trial_credits"]);
    
    settings?.forEach((s: any) => {
      if (s.key === "default_markup_percent") setDefaultMarkup(s.value);
      if (s.key === "free_trial_credits") setFreeTrialCredits(s.value);
    });
    
    setLoading(false);
  };

  const handleAddVIP = async () => {
    let targetUserId = selectedUserId;
    
    // Se estiver no modo email, buscar ou criar usuário
    if (addMode === "email") {
      if (!newUserEmail.trim()) {
        toast.error("Digite um email válido");
        return;
      }
      
      // Buscar usuário pelo email
      const { data: userData, error: userError } = await (supabase as any)
        .from("profiles")
        .select("id, email, is_vip")
        .eq("email", newUserEmail.trim())
        .maybeSingle();
      
      if (userError) {
        toast.error("Erro ao buscar usuário: " + userError.message);
        return;
      }
      
      if (userData) {
        if (userData.is_vip) {
          toast.error("Este usuário já é VIP");
          return;
        }
        targetUserId = userData.id;
      } else {
        toast.error("Usuário não encontrado. Ele precisa fazer login primeiro.");
        return;
      }
    }
    
    if (!targetUserId) {
      toast.error(addMode === "select" ? "Selecione um usuário" : "Usuário não encontrado");
      return;
    }
    
    const markup = parseFloat(markupPercent) || 0;
    
    try {
      // Atualizar usuário
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          is_vip: true,
          vip_markup_percent: markup,
          vip_notes: notes.trim() || null,
        })
        .eq("id", targetUserId);
      
      if (error) throw error;
      
      // Registrar no log de auditoria
      await (supabase as any).from("vip_changes_log").insert({
        user_id: targetUserId,
        changed_by: (await supabase.auth.getUser()).data.user?.id,
        old_is_vip: false,
        new_is_vip: true,
        old_markup_percent: null,
        new_markup_percent: markup,
        notes: `Usuário promovido a VIP com markup de ${markup}%`,
      });
      
      toast.success("Usuário VIP adicionado!");
      setShowAddForm(false);
      setSelectedUserId("");
      setNewUserEmail("");
      setMarkupPercent("0");
      setNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar VIP");
    }
  };

  const handleUpdateVIP = async (user: VIPUser) => {
    const markup = parseFloat(markupPercent) || 0;
    
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          vip_markup_percent: markup,
          vip_notes: notes.trim() || null,
        })
        .eq("id", user.id);
      
      if (error) throw error;
      
      // Log de auditoria
      await (supabase as any).from("vip_changes_log").insert({
        user_id: user.id,
        changed_by: (await supabase.auth.getUser()).data.user?.id,
        old_is_vip: true,
        new_is_vip: true,
        old_markup_percent: user.vip_markup_percent,
        new_markup_percent: markup,
        notes: `Markup atualizado de ${user.vip_markup_percent}% para ${markup}%`,
      });
      
      toast.success("VIP atualizado!");
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar VIP");
    }
  };

  const handleRemoveVIP = async (userId: string) => {
    if (!confirm("Remover status VIP deste usuário?")) return;
    
    try {
      const user = vipUsers.find(u => u.id === userId);
      
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          is_vip: false,
          vip_markup_percent: 0,
        })
        .eq("id", userId);
      
      if (error) throw error;
      
      // Log de auditoria
      await (supabase as any).from("vip_changes_log").insert({
        user_id: userId,
        changed_by: (await supabase.auth.getUser()).data.user?.id,
        old_is_vip: true,
        new_is_vip: false,
        old_markup_percent: user?.vip_markup_percent || 0,
        new_markup_percent: 0,
        notes: "Status VIP removido",
      });
      
      toast.success("Status VIP removido!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover VIP");
    }
  };

  const handleSaveSettings = async () => {
    try {
      await supabase.from("app_settings").upsert([
        { key: "default_markup_percent", value: defaultMarkup },
        { key: "free_trial_credits", value: freeTrialCredits },
      ], { onConflict: "key" });
      
      toast.success("Configurações salvas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configurações");
    }
  };

  const startEdit = (user: VIPUser) => {
    setEditingUser(user);
    setMarkupPercent(user.vip_markup_percent.toString());
    setNotes(user.vip_notes || "");
  };

  return (
    <div className="space-y-6">
      
      {/* Configurações Globais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Configurações de Preços
          </CardTitle>
          <CardDescription>
            Configure o markup padrão e créditos gratuitos para novos usuários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Markup Padrão (%)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(e.target.value)}
                  placeholder="100"
                />
                <span className="text-sm text-muted-foreground self-center">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                100% = dobro do custo da API
              </p>
            </div>
            
            <div>
              <Label>Créditos Gratuitos (centavos)</Label>
              <Input
                type="number"
                value={freeTrialCredits}
                onChange={(e) => setFreeTrialCredits(e.target.value)}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                R$ {(parseInt(freeTrialCredits) / 100).toFixed(2)} para novos usuários
              </p>
            </div>
          </div>
          
          <Button onClick={handleSaveSettings} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* Adicionar Usuário VIP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Usuários VIP
              </CardTitle>
              <CardDescription>
                Usuários VIP pagam apenas o custo da API sem markup adicional
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant={showAddForm ? "outline" : "default"}
              className="gap-2"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddForm ? "Cancelar" : "Adicionar VIP"}
            </Button>
          </div>
        </CardHeader>
        
        {showAddForm && (
          <CardContent className="space-y-4 border-t pt-4">
            {/* Toggle entre selecionar da lista ou digitar email */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={addMode === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("select")}
                className="flex-1"
              >
                Selecionar da Lista
              </Button>
              <Button
                type="button"
                variant={addMode === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("email")}
                className="flex-1"
              >
                Digitar Email
              </Button>
            </div>

            {addMode === "select" ? (
              <div>
                <Label>Selecionar Usuário</Label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecione um usuário...</option>
                  {allUsers.filter(u => !u.is_vip).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} {u.full_name ? `(${u.full_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <Label>Email do Usuário</Label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="usuario@email.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O usuário deve já ter uma conta no sistema
                </p>
              </div>
            )}
            
            <div>
              <Label>Markup Personalizado (%)</Label>
              <Input
                type="number"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                0% = sem markup (apenas custo da API)
              </p>
            </div>
            
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Cliente especial, parceiro, etc."
                rows={2}
              />
            </div>
            
            <Button onClick={handleAddVIP} className="w-full gap-2">
              <Crown className="w-4 h-4" />
              Adicionar como VIP
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Lista de Usuários VIP */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários VIP Ativos ({vipUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : vipUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum usuário VIP cadastrado ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Markup</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Consumo</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vipUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="font-medium text-sm">{user.email}</p>
                          {user.full_name && (
                            <p className="text-xs text-muted-foreground">{user.full_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.vip_markup_percent === 0 ? "default" : "secondary"}>
                        {user.vip_markup_percent}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-semibold">
                      R$ {(user.balance_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      R$ {(user.total_spent_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {user.vip_notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(user)}
                          className="h-8 gap-1"
                        >
                          <Save className="w-3 h-3" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveVIP(user.id)}
                          className="h-8 gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      {editingUser && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Editando: {editingUser.email}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingUser(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Markup Personalizado (%)</Label>
              <Input
                type="number"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => handleUpdateVIP(editingUser)}
                className="flex-1 gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
