import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExternalLink, Save, Eye, EyeOff } from "lucide-react";

export default function SuperAdminCTATab() {
  const [enabled, setEnabled] = useState(true);
  const [text, setText] = useState("🚀 Experimente Agora Grátis!");
  const [url, setUrl] = useState("https://iaprogramador.online");
  const [position, setPosition] = useState<"header" | "footer" | "floating">("floating");
  const [color, setColor] = useState("#667eea");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["cta_enabled", "cta_text", "cta_url", "cta_position", "cta_color"]);

    if (data) {
      data.forEach((item: any) => {
        switch (item.key) {
          case "cta_enabled":
            setEnabled(item.value === "true");
            break;
          case "cta_text":
            setText(item.value);
            break;
          case "cta_url":
            setUrl(item.value);
            break;
          case "cta_position":
            setPosition(item.value as any);
            break;
          case "cta_color":
            setColor(item.value);
            break;
        }
      });
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      await supabase.from("app_settings").upsert([
        { key: "cta_enabled", value: enabled.toString() },
        { key: "cta_text", value: text },
        { key: "cta_url", value: url },
        { key: "cta_position", value: position },
        { key: "cta_color", value: color },
      ], { onConflict: "key" });

      toast.success("CTA atualizado! Recarregue a página para ver as mudanças.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar CTA");
    }
  };

  const positions = [
    { value: "floating", label: "Flutuante (canto inferior direito)", icon: "🎈" },
    { value: "header", label: "Barra no topo", icon: "⬆️" },
    { value: "footer", label: "Barra no rodapé", icon: "⬇️" },
  ];

  return (
    <div className="space-y-6">
      
      {/* Configuração do CTA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-primary" />
                Call-to-Action Global
              </CardTitle>
              <CardDescription>
                Configure um botão de chamada para ação visível em todo o site
              </CardDescription>
            </div>
            
            <Button
              variant={enabled ? "default" : "outline"}
              onClick={() => setEnabled(!enabled)}
              className="gap-2"
            >
              {enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {enabled ? "Ativado" : "Desativado"}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          
          {/* Texto do CTA */}
          <div>
            <Label>Texto do Botão</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="🚀 Experimente Agora Grátis!"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use emojis para chamar mais atenção! Máximo 50 caracteres.
            </p>
          </div>

          {/* URL de Redirecionamento */}
          <div>
            <Label>URL de Redirecionamento</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://iaprogramador.online"
              type="url"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Para onde o usuário será redirecionado ao clicar
            </p>
          </div>

          {/* Posição */}
          <div>
            <Label>Posição do CTA</Label>
            <div className="grid gap-2 mt-2">
              {positions.map((pos) => (
                <button
                  key={pos.value}
                  onClick={() => setPosition(pos.value as any)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    position === pos.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-2xl">{pos.icon}</span>
                  <span className="text-sm font-medium">{pos.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div>
            <Label>Cor do Botão</Label>
            <div className="flex gap-3 items-center">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#667eea"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Escolha uma cor que combine com sua marca
            </p>
          </div>

          {/* Preview */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-3 text-center">PREVIEW</p>
            
            {position === "floating" && (
              <div className="flex justify-end">
                <Button
                  style={{
                    background: `linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%)`,
                  }}
                  className="gap-2 shadow-lg"
                >
                  {text}
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            {position === "header" && (
              <div
                className="w-full py-3 px-4 flex items-center justify-center gap-3 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%)`,
                }}
              >
                <span className="text-white font-semibold text-sm">{text}</span>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  Acessar
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            )}
            
            {position === "footer" && (
              <div
                className="w-full py-4 px-4 flex items-center justify-center gap-3 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%)`,
                }}
              >
                <span className="text-white font-semibold text-sm">{text}</span>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  Acessar
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Botão Salvar */}
          <Button onClick={handleSave} className="w-full gap-2" size="lg">
            <Save className="w-4 h-4" />
            Salvar Configurações
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            💡 Dica: Recarregue a página após salvar para ver o CTA em ação!
          </p>
        </CardContent>
      </Card>

      {/* Estatísticas (futuro) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estatísticas do CTA</CardTitle>
          <CardDescription>Em breve: tracking de cliques e conversões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">-</p>
              <p className="text-xs text-muted-foreground mt-1">Visualizações</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">-</p>
              <p className="text-xs text-muted-foreground mt-1">Cliques</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">-</p>
              <p className="text-xs text-muted-foreground mt-1">Taxa de Conversão</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Função auxiliar para ajustar cor
function adjustColor(color: string, amount: number): string {
  const clamp = (num: number) => Math.min(Math.max(num, 0), 255);
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const newR = clamp(r + amount);
  const newG = clamp(g + amount);
  const newB = clamp(b + amount);
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}
