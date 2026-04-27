import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Verificar se há tokens na URL (hash fragment)
        const hash = window.location.hash;
        const query = window.location.search;

        // Se houver código de autorização, processar
        if (hash || query) {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            toast.error("Erro na autenticação: " + error.message);
            navigate("/?error=oauth");
            return;
          }

          if (data?.session) {
            toast.success("Login realizado com sucesso!");
            navigate("/?oauth=success");
            return;
          }
        }

        // Se não houver sessão, redirecionar para home
        navigate("/");
      } catch (err: any) {
        toast.error("Erro ao processar login: " + err.message);
        navigate("/?error=oauth");
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Processando login...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
