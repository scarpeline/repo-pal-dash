import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import GitHubCallback from "./pages/GitHubCallback";
import SuperAdmin from "./pages/SuperAdmin";
import WalletPage from "./pages/WalletPage";
import AffiliatePage from "./pages/AffiliatePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/github/callback" element={<GitHubCallback />} />
            <Route path="/admin" element={<SuperAdmin />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/affiliate" element={<AffiliatePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
