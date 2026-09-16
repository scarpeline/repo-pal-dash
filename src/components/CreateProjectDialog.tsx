import { useState } from "react";
import { Loader2, Plus, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProject, type GHRepo, type ProjectTemplate } from "@/lib/github";

interface CreateProjectDialogProps {
  token: string;
  onCreated: (repo: GHRepo) => void;
}

const TEMPLATES: { id: ProjectTemplate; label: string; description: string }[] = [
  { id: "react-vite", label: "App React", description: "React + Vite + TypeScript, pronto para crescer" },
  { id: "static-site", label: "Site simples", description: "HTML, CSS e JavaScript em uma página" },
  { id: "node-api", label: "API Node", description: "Servidor Express com rota de saúde" },
  { id: "empty", label: "Vazio", description: "Somente o README, você decide o resto" },
];

const CreateProjectDialog = ({ token, onCreated }: CreateProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [template, setTemplate] = useState<ProjectTemplate>("react-vite");
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Dê um nome ao projeto.");
      return;
    }
    setCreating(true);
    setProgress("Preparando...");
    try {
      const repo = await createProject(token, name, {
        description,
        isPrivate,
        template,
        onProgress: setProgress,
      });
      toast.success(`Projeto ${repo.full_name} criado!`);
      onCreated(repo);
      setOpen(false);
      setName("");
      setDescription("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Não foi possível criar o projeto: ${message}`);
    } finally {
      setCreating(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !creating && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-[11px]">
          <Plus className="h-3.5 w-3.5" /> Novo projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" /> Criar projeto
          </DialogTitle>
          <DialogDescription>
            Criamos o projeto na sua conta do GitHub já com o código inicial. Depois basta pedir mudanças no chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Nome</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="meu-app-incrivel"
              disabled={creating}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">Descrição (opcional)</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: painel de vendas com login"
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label>Ponto de partida</Label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={creating}
                  onClick={() => setTemplate(item.id)}
                  className={`rounded-lg border p-2 text-left transition-colors ${
                    template === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-xs font-semibold text-foreground">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-xs font-medium text-foreground">Projeto privado</p>
              <p className="text-[10px] text-muted-foreground">Somente você e quem convidar terão acesso.</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={creating} />
          </div>

          {creating && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress}
            </p>
          )}

          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? "Criando..." : "Criar projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
