import { useAuth } from "@/contexts/AuthContext";
import { Github, Code2, GitBranch, GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login, isLoading } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 text-center space-y-8">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Code2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Git Editor
          </h1>
          <p className="text-muted-foreground">
            Navegue, edite e gerencie seus repositórios GitHub direto do navegador.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4">
          {[
            { icon: Code2, label: "Editar código" },
            { icon: GitBranch, label: "Branches" },
            { icon: GitPullRequest, label: "Pull Requests" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card border border-border">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={login}
          disabled={isLoading}
          size="lg"
          className="w-full gap-2 bg-github text-background hover:bg-github/90 font-semibold"
        >
          <Github className="h-5 w-5" />
          {isLoading ? "Conectando..." : "Entrar com GitHub"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Requer permissão para acessar seus repositórios.
        </p>
      </div>
    </div>
  );
}
