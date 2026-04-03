import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // The AuthContext handles the code exchange.
    // After exchange, redirect to home.
    const params = new URLSearchParams(window.location.search);
    if (params.get("code")) {
      // Let AuthContext handle it, then redirect
      const interval = setInterval(() => {
        if (localStorage.getItem("gh_token")) {
          clearInterval(interval);
          navigate("/", { replace: true });
        }
      }, 200);
      return () => clearInterval(interval);
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">Autenticando...</p>
      </div>
    </div>
  );
}
