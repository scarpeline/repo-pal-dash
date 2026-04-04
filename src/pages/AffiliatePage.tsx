import { useAuth } from "@/contexts/AuthContext";
import AffiliateDashboard from "@/components/AffiliateDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AffiliatePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Editor
        </Button>
        <AffiliateDashboard />
      </div>
    </div>
  );
};

export default AffiliatePage;
