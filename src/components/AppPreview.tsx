import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  Smartphone, 
  Monitor, 
  Tablet, 
  RefreshCw, 
  Eye,
  Code,
  Settings,
  Globe,
  Zap
} from "lucide-react";
import { toast } from "sonner";

interface PreviewProps {
  repoUrl?: string;
  isLive?: boolean;
}

export default function AppPreview({ repoUrl, isLive = false }: PreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // URLs base para preview
  const previewUrls = {
    development: "http://localhost:5173",
    staging: "https://staging.iaprogramador.online", 
    production: "https://iaprogramador.online"
  };

  useEffect(() => {
    // Determinar URL de preview baseada no ambiente
    const url = isLive ? previewUrls.production : previewUrls.production;
    setPreviewUrl(url);
  }, [isLive]);

  const deviceDimensions = {
    desktop: { width: "100%", height: "600px" },
    tablet: { width: "768px", height: "1024px" },
    mobile: { width: "375px", height: "667px" }
  };

  const refreshPreview = () => {
    setIsLoading(true);
    setRefreshKey(prev => prev + 1);
    setTimeout(() => {
      setIsLoading(false);
      setIsInitialLoad(false);
      toast.success("Preview atualizado!");
    }, 1000);
  };

  const openInNewTab = () => {
    window.open(previewUrl, "_blank");
  };

  // Inicializar preview
  useEffect(() => {
    if (previewUrl) {
      setTimeout(() => {
        setIsLoading(false);
        setIsInitialLoad(false);
      }, 2000);
    }
  }, [previewUrl]);

  const DeviceIcon = device === "desktop" ? Monitor : device === "tablet" ? Tablet : Smartphone;

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview do IAProgramador
              <Badge variant={isLive ? "default" : "secondary"}>
                {isLive ? "Produção" : "Desenvolvimento"}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPreview}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openInNewTab}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Abrir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Device Selector */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium">Dispositivo:</span>
            <div className="flex gap-1">
              {(["desktop", "tablet", "mobile"] as const).map((d) => (
                <Button
                  key={d}
                  variant={device === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDevice(d)}
                  className="flex items-center gap-1"
                >
                  {d === "desktop" ? <Monitor className="w-3 h-3" /> :
                   d === "tablet" ? <Tablet className="w-3 h-3" /> :
                   <Smartphone className="w-3 h-3" />}
                  <span className="text-xs capitalize">
                    {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablet" : "Mobile"}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* URL Info */}
          <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono text-muted-foreground">
              {previewUrl}
            </span>
            {isLive && (
              <Badge variant="default" className="ml-auto">
                <Zap className="w-3 h-3 mr-1" />
                Ao Vivo
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Frame */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-center">
            <div 
              className="border border-border rounded-lg overflow-hidden bg-white shadow-lg transition-all duration-300"
              style={{
                width: deviceDimensions[device].width,
                height: deviceDimensions[device].height,
                maxWidth: "100%"
              }}
            >
              {isLoading || isInitialLoad ? (
                <div className="flex items-center justify-center h-full bg-gray-50">
                  <div className="text-center space-y-3">
                    <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isInitialLoad ? "Carregando preview..." : "Atualizando preview..."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {previewUrl}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={openInNewTab}
                      className="mt-2"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Abrir em nova aba
                    </Button>
                  </div>
                </div>
              ) : (
                <iframe
                  key={refreshKey}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="IAProgramador Preview"
                  allowFullScreen
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    toast.error("Erro ao carregar preview. Tente abrir em nova aba.");
                  }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDevice("desktop")}
              className="flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              Desktop
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDevice("tablet")}
              className="flex items-center gap-2"
            >
              <Tablet className="w-4 h-4" />
              Tablet
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDevice("mobile")}
              className="flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              Mobile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openInNewTab}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Nova Aba
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
