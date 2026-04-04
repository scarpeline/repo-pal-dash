import { useAuth } from "@/contexts/AuthContext";
import AuthPage from "./AuthPage";
import EditorPage from "./EditorPage";

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <EditorPage />;
}
