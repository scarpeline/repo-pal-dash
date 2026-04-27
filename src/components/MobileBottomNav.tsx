import { 
  FolderGit2, 
  MessageSquare, 
  Terminal, 
  Eye, 
  Code2,
  ChevronUp,
  X
} from "lucide-react";

interface MobileBottomNavProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  bottomOpen: boolean;
  setBottomOpen: (open: boolean) => void;
  bottomTab: "chat" | "terminal";
  setBottomTab: (tab: "chat" | "terminal") => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  hasOpenTabs: boolean;
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
  openTabs: Array<{ path: string; name: string }>;
}

export const MobileBottomNav = ({
  sidebarOpen,
  setSidebarOpen,
  bottomOpen,
  setBottomOpen,
  bottomTab,
  setBottomTab,
  showPreview,
  setShowPreview,
  hasOpenTabs,
  activeTab,
  setActiveTab,
  openTabs,
}: MobileBottomNavProps) => {
  const handleChatClick = () => {
    if (bottomOpen && bottomTab === "chat") {
      setBottomOpen(false);
    } else {
      setBottomTab("chat");
      setBottomOpen(true);
    }
  };

  const handleTerminalClick = () => {
    if (bottomOpen && bottomTab === "terminal") {
      setBottomOpen(false);
    } else {
      setBottomTab("terminal");
      setBottomOpen(true);
    }
  };

  return (
    <>
      {/* Quick Tab Switcher - Mostra apenas quando há abas abertas e preview está fechado */}
      {hasOpenTabs && !showPreview && !bottomOpen && (
        <div className="md:hidden fixed bottom-[72px] left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border px-2 py-1.5">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {openTabs.map((tab) => (
              <button
                key={tab.path}
                onClick={() => setActiveTab(tab.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === tab.path
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="w-3 h-3" />
                <span className="max-w-[80px] truncate">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-[72px] px-2">
          {/* Files / Sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${
              sidebarOpen
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <FolderGit2 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Arquivos</span>
          </button>

          {/* Chat */}
          <button
            onClick={handleChatClick}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${
              bottomOpen && bottomTab === "chat"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-medium">Chat</span>
          </button>

          {/* Preview Toggle - Central/Destaque */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${
              showPreview
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="w-5 h-5" />
            <span className="text-[10px] font-medium">Preview</span>
          </button>

          {/* Terminal */}
          <button
            onClick={handleTerminalClick}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${
              bottomOpen && bottomTab === "terminal"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Terminal className="w-5 h-5" />
            <span className="text-[10px] font-medium">Terminal</span>
          </button>

          {/* Tabs Toggle */}
          {hasOpenTabs && (
            <button
              onClick={() => {
                // Scroll to show tab bar
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }}
              className="flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
              <span className="text-[10px] font-medium">Abas</span>
              <span className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground text-[9px] rounded-full flex items-center justify-center">
                {openTabs.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Overlay para fechar painéis */}
      {(sidebarOpen || bottomOpen) && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={() => {
            setSidebarOpen(false);
            setBottomOpen(false);
          }}
        />
      )}
    </>
  );
};

export default MobileBottomNav;
