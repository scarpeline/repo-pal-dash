import { useAuth } from "@/contexts/AuthContext";
import LoginPage from "./LoginPage";
import Dashboard from "./Dashboard";

export default function Index() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) return <LoginPage />;
  return <Dashboard />;
}
