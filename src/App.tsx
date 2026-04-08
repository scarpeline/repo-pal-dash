import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPWA } from "@/components/InstallPWA";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import GitHubCallback from "./pages/GitHubCallback";
import GoogleCallback from "./pages/GoogleCallback";
import OAuthCallback from "./pages/OAuthCallback";
import SuperAdmin from "./pages/SuperAdmin";
import WalletPage from "./pages/WalletPage";
import AffiliatePage from "./pages/AffiliatePage";
import RepoFullAccess from "./pages/RepoFullAccess";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <InstallPWA />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/github/callback" element={<GitHubCallback />} />
              <Route path="/google/callback" element={<GoogleCallback />} />
              <Route path="/~oauth/initiate" element={<OAuthCallback />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/super-admin2026ok" element={<SuperAdmin />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/affiliate" element={<AffiliatePage />} />
              <Route path="/repo-access" element={<RepoFullAccess />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
