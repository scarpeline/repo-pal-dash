import { useState, useEffect } from "react";
import { Brain, Zap, Code, Sparkles, Bot, Cpu, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AI_PROVIDERS,
  AIProvider,
} from "@/integrations/ai";
import { toast } from "sonner";

interface AISelectorProps {
  onProviderChange?: (provider: AIProvider) => void;
  selectedProvider?: string;
  autoMode?: boolean;
  onAutoModeChange?: (enabled: boolean) => void;
}

const providerIcons: Record<string, React.ReactNode> = {
  gemini: <Sparkles className="w-4 h-4 text-blue-400" />,
  deepseek: <Code className="w-4 h-4 text-purple-400" />,
  groq: <Zap className="w-4 h-4 text-yellow-400" />,
  mistral: <Bot className="w-4 h-4 text-green-400" />,
  kimi: <Brain className="w-4 h-4 text-red-400" />,
  openrouter: <Network className="w-4 h-4 text-orange-400" />,
  openai: <Cpu className="w-4 h-4 text-emerald-400" />,
};

export function AISelector({ 
  onProviderChange, 
  selectedProvider, 
  autoMode = true,
  onAutoModeChange 
}: AISelectorProps) {
  const [providers, setProviders] = useState(AI_PROVIDERS);
  const [activeProvider, setActiveProvider] = useState<AIProvider>(
    providers.find(p => p.id === selectedProvider) || providers[0]
  );
  const [isAuto, setIsAuto] = useState(autoMode);

  useEffect(() => {
    // DeepSeek e Kimi têm API keys configuradas no Supabase Secrets
    // Gemini sempre habilitado, os demais dependem de keys no frontend (não usadas aqui)
    const alwaysEnabled = ["gemini", "deepseek", "kimi", "openrouter"];
    const updated = providers.map(p => ({
      ...p,
      enabled: alwaysEnabled.includes(p.id) ? true : !!import.meta.env[p.apiKeyEnv],
    }));
    setProviders(updated);
  }, []);

  const handleSelect = (provider: AIProvider) => {
    if (!provider.enabled) {
      toast.error(`${provider.name} não está configurado. Adicione ${provider.apiKeyEnv} nas Configurações.`);
      return;
    }
    setActiveProvider(provider);
    setIsAuto(false);
    onAutoModeChange?.(false);
    onProviderChange?.(provider);
    toast.success(`IA alterada para: ${provider.name}`);
  };

  const handleAutoMode = () => {
    setIsAuto(true);
    onAutoModeChange?.(true);
    toast.success("🧠 Modo Inteligente ativado! A IA será selecionada automaticamente.");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isAuto ? (
            <><Brain className="w-4 h-4 text-primary" /><span className="hidden sm:inline">Modo Inteligente</span></>
          ) : (
            <>{providerIcons[activeProvider.id] || <Brain className="w-4 h-4" />}<span className="hidden sm:inline">{activeProvider.name}</span></>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Selecionar IA
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleAutoMode} 
          className={`gap-2 ${isAuto ? "bg-accent" : ""}`}
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <div className="flex flex-col">
            <span className="font-medium">🧠 Modo Inteligente (Auto)</span>
            <span className="text-xs text-muted-foreground">
              Escolhe automaticamente a melhor IA para cada tarefa
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">IAs Disponíveis</DropdownMenuLabel>
        
        {providers.map((provider) => (
          <DropdownMenuItem
            key={provider.id}
            onClick={() => handleSelect(provider)}
            className={`gap-2 ${!isAuto && activeProvider.id === provider.id ? "bg-accent" : ""} ${
              !provider.enabled ? "opacity-50" : ""
            }`}
          >
            {providerIcons[provider.id] || <Brain className="w-4 h-4" />}
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{provider.name}</span>
                <span className={`text-xs ${provider.enabled ? "text-green-500" : "text-gray-400"}`}>
                  {provider.enabled ? "●" : "⚙️"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>
                  {provider.pricing.inputPer1M === 0 ? "Grátis" : `$${provider.pricing.inputPer1M}`}
                </span>
                <span>•</span>
                <span>⚡{provider.characteristics.speed}/10</span>
                <span>•</span>
                <span className="truncate">{provider.characteristics.bestFor.slice(0, 2).join(", ")}</span>
              </div>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-1">
          <p>💡 <strong>Modo Inteligente recomendado</strong></p>
          <p>🎯 Backend → Mistral | 🚀 Rápido → Groq | 💻 Código → DeepSeek</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
