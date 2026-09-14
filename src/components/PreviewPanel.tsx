import { useState, useEffect, useMemo, useRef } from "react";
import { ExternalLink, RefreshCw, Monitor, Smartphone, Tablet, Code, Eye, Play, Loader2, AlertTriangle, Rocket } from "lucide-react";
import { buildRepoApp } from "@/lib/repoRunner";

interface PreviewPanelProps {
  url: string;
  onRefresh: () => void;
  fileContent?: string;
  fileName?: string;
  onUrlChange?: (url: string) => void;
  /** Dados do repositório conectado para rodar o app ao vivo no navegador */
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  repoLabel?: string;
}

const getLanguage = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "html", htm: "html", jsx: "jsx", tsx: "tsx",
    md: "markdown", markdown: "markdown",
    css: "css", scss: "css",
    json: "json", svg: "svg",
  };
  return map[ext] || "text";
};

const renderMarkdown = (md: string): string => {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1em;font-weight:bold;margin:12px 0 4px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.3em;font-weight:bold;margin:16px 0 6px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.6em;font-weight:bold;margin:20px 0 8px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#1e1e2e;padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
};

const PreviewPanel = ({ url, onRefresh, fileContent, fileName, onUrlChange }: PreviewPanelProps) => {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [key, setKey] = useState(0);
  const [mode, setMode] = useState<"preview" | "source">("preview");

  const lang = fileName ? getLanguage(fileName) : "text";
  const hasPreviewable = lang === "html" || lang === "markdown" || lang === "svg";

  const previewSrc = useMemo(() => {
    if (!fileContent || !fileName) return null;

    if (lang === "html" || lang === "svg") {
      return `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,system-ui,sans-serif;margin:20px;color:#e0e0e0;background:#0d1117;}</style></head><body>${fileContent}</body></html>`
      )}`;
    }

    if (lang === "markdown") {
      const html = renderMarkdown(fileContent);
      return `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,system-ui,sans-serif;margin:20px;max-width:720px;color:#e0e0e0;background:#0d1117;line-height:1.7;}a{color:#58a6ff;}code{background:#161b22;padding:2px 6px;border-radius:4px;}</style></head><body>${html}</body></html>`
      )}`;
    }

    return null;
  }, [fileContent, fileName, lang]);

  const viewportStyles: Record<string, { width: string; maxWidth: string }> = {
    desktop: { width: "100%", maxWidth: "100%" },
    tablet: { width: "768px", maxWidth: "768px" },
    mobile: { width: "375px", maxWidth: "375px" },
  };

  const handleRefresh = () => {
    setKey((k) => k + 1);
    onRefresh();
  };

  const iframeSrc = url || previewSrc;

  return (
    <div className="flex flex-col h-full bg-editor-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
        <button onClick={handleRefresh} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted-foreground/10 rounded-lg shrink-0" title="Recarregar">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {onUrlChange ? (
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Cole aqui a URL live da sua aplicação (Ex: seu-site.vercel.app)"
            className="flex-1 bg-input/50 focus:bg-input border border-border rounded px-2.5 py-1 text-sm text-foreground font-mono outline-none focus:border-primary placeholder:text-muted-foreground/50 transition-colors min-w-0"
          />
        ) : (
          <div className="flex-1 bg-input border border-border rounded px-2.5 py-1 text-sm text-muted-foreground font-mono truncate min-w-0">
            {url || fileName || "preview"}
          </div>
        )}

        {/* Saldo/depósito ficam apenas no topo do app — removido daqui para evitar duplicação */}

        {/* Viewport controls */}
        <div className="flex items-center gap-0.5 bg-input border border-border rounded-md p-0.5">
          {([
            { id: "desktop" as const, icon: Monitor },
            { id: "tablet" as const, icon: Tablet },
            { id: "mobile" as const, icon: Smartphone },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewport(v.id)}
              className={`p-1 rounded transition-colors ${viewport === v.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <v.icon className="w-3 h-3" />
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        {fileContent && (
          <div className="flex items-center gap-0.5 bg-input border border-border rounded-md p-0.5">
            <button
              onClick={() => setMode("preview")}
              className={`p-1 rounded transition-colors ${mode === "preview" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Preview"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMode("source")}
              className={`p-1 rounded transition-colors ${mode === "source" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Código fonte"
            >
              <Code className="w-3 h-3" />
            </button>
          </div>
        )}

        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Preview content */}
      <div className="flex-1 relative overflow-auto flex justify-center">
        {mode === "source" && fileContent ? (
          <pre className="w-full p-4 text-sm text-foreground font-mono whitespace-pre-wrap overflow-auto bg-editor-bg">
            {fileContent}
          </pre>
        ) : iframeSrc ? (
          <div style={viewportStyles[viewport]} className="h-full transition-all duration-300 mx-auto">
            <iframe
              key={key}
              src={iframeSrc}
              className="w-full h-full border-none bg-background"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Preview"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center mx-auto">
                <Eye className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <div>
                <p className="font-medium">Preview</p>
                <p className="text-muted-foreground/60 mt-1">
                  Abra um arquivo HTML, Markdown ou SVG para visualizar
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
