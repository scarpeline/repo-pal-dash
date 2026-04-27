import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";

interface CTAConfig {
  enabled: boolean;
  text: string;
  url: string;
  position: "header" | "footer" | "floating";
  color: string;
}

export default function GlobalCTA() {
  const [config, setConfig] = useState<CTAConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["cta_enabled", "cta_text", "cta_url", "cta_position", "cta_color"]);

    if (!data) return;

    const configMap: Record<string, string> = {};
    data.forEach((item: any) => {
      configMap[item.key] = item.value;
    });

    setConfig({
      enabled: configMap.cta_enabled === "true",
      text: configMap.cta_text || "🚀 Experimente Agora!",
      url: configMap.cta_url || "https://iaprogramador.online",
      position: (configMap.cta_position as any) || "floating",
      color: configMap.cta_color || "#667eea",
    });
  };

  if (!config || !config.enabled || dismissed) return null;

  const handleClick = () => {
    window.open(config.url, "_blank");
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    // Salvar no localStorage para não mostrar novamente nesta sessão
    localStorage.setItem("cta_dismissed", "true");
  };

  // Verificar se foi dismissed nesta sessão
  useEffect(() => {
    const wasDismissed = localStorage.getItem("cta_dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  // Floating CTA (canto inferior direito)
  if (config.position === "floating") {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: "2s" }}
      >
        <div className="relative group">
          <Button
            onClick={handleClick}
            className="gap-2 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 text-base px-6 py-6 rounded-2xl font-bold"
            style={{
              background: `linear-gradient(135deg, ${config.color} 0%, ${adjustColor(config.color, -20)} 100%)`,
              border: "2px solid rgba(255,255,255,0.2)",
            }}
          >
            {config.text}
            <ExternalLink className="w-5 h-5" />
          </Button>
          
          {/* Botão de fechar */}
          <button
            onClick={handleDismiss}
            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
          >
            <X className="w-3 h-3" />
          </button>
          
          {/* Efeito de pulso */}
          <div
            className="absolute inset-0 rounded-2xl animate-ping opacity-20"
            style={{ backgroundColor: config.color }}
          />
        </div>
      </div>
    );
  }

  // Header CTA (barra no topo)
  if (config.position === "header") {
    return (
      <div
        className="w-full py-3 px-4 flex items-center justify-center gap-3 relative animate-in slide-in-from-top-2 duration-500"
        style={{
          background: `linear-gradient(135deg, ${config.color} 0%, ${adjustColor(config.color, -20)} 100%)`,
        }}
      >
        <span className="text-white font-semibold text-sm md:text-base">
          {config.text}
        </span>
        <Button
          onClick={handleClick}
          variant="secondary"
          size="sm"
          className="gap-1.5 font-bold"
        >
          Acessar
          <ExternalLink className="w-4 h-4" />
        </Button>
        
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Footer CTA (barra no rodapé)
  if (config.position === "footer") {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 w-full py-4 px-4 flex items-center justify-center gap-3 relative z-40 animate-in slide-in-from-bottom-2 duration-500 shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${config.color} 0%, ${adjustColor(config.color, -20)} 100%)`,
        }}
      >
        <span className="text-white font-semibold text-sm md:text-base">
          {config.text}
        </span>
        <Button
          onClick={handleClick}
          variant="secondary"
          size="sm"
          className="gap-1.5 font-bold"
        >
          Acessar
          <ExternalLink className="w-4 h-4" />
        </Button>
        
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}

// Função auxiliar para ajustar cor (escurecer/clarear)
function adjustColor(color: string, amount: number): string {
  const clamp = (num: number) => Math.min(Math.max(num, 0), 255);
  
  // Converter hex para RGB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Ajustar
  const newR = clamp(r + amount);
  const newG = clamp(g + amount);
  const newB = clamp(b + amount);
  
  // Converter de volta para hex
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}
