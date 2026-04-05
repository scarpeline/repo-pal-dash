import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { GitBranch, GitCommit, Upload, Loader2, CheckCircle, Terminal } from "lucide-react";

interface GitAutoCommitProps {
  onCommitComplete?: (message: string, hash: string) => void;
}

export const GitAutoCommit = ({ onCommitComplete }: GitAutoCommitProps) => {
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [status, setStatus] = useState("");
  const [lastCommit, setLastCommit] = useState<{ message: string; hash: string } | null>(null);

  const executeCommand = async (command: string): Promise<string> => {
    // Simular execução do comando (em produção, isso seria uma API real)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (command.includes('git status --porcelain')) {
          // Simular que há arquivos modificados
          resolve(' M src/components/GitAutoCommit.tsx\n M package.json\n M scripts/auto-commit.js');
        } else if (command.includes('git commit')) {
          // Simular commit bem-sucedido
          const hash = Math.random().toString(36).substring(2, 9);
          resolve(`[${hash}] feat: adiciona componente de auto commit\n 1 file changed, 50 insertions(+)`);
        } else if (command.includes('git push')) {
          resolve('To https://github.com/scarpeline/repo-pal-dash.git\n  abc123..def456  main -> main');
        } else {
          resolve('Command executed successfully');
        }
      }, 1000);
    });
  };

  const handleAutoCommit = async (pushToGitHub = false) => {
    setIsCommitting(true);
    setStatus("Verificando alterações...");
    
    try {
      // Verificar status
      const statusOutput = await executeCommand('git status --porcelain');
      
      if (!statusOutput.trim()) {
        toast.error("Nenhuma alteração para commit!");
        setStatus("");
        setIsCommitting(false);
        return;
      }

      setStatus("Adicionando arquivos...");
      await executeCommand('git add .');

      // Gerar mensagem automática se não fornecida
      let message = commitMessage;
      if (!message.trim()) {
        const files = statusOutput.split('\n').filter(line => line.trim());
        const hasPackageJson = files.some(f => f.includes('package.json'));
        const hasTSX = files.some(f => f.includes('.tsx'));
        const hasTS = files.some(f => f.includes('.ts'));
        
        if (hasPackageJson) message = 'chore: atualiza dependências e scripts';
        else if (hasTSX || hasTS) message = 'feat: melhoria nos componentes e funcionalidades';
        else message = `chore: atualização automática - ${new Date().toLocaleString('pt-BR')}`;
      }

      setStatus(`Fazendo commit: ${message}`);
      const commitOutput = await executeCommand(`git commit -m "${message}"`);
      
      // Extrair hash do commit
      const hashMatch = commitOutput.match(/\[([a-f0-9]+)\]/);
      const commitHash = hashMatch ? hashMatch[1] : 'unknown';

      setLastCommit({ message, hash: commitHash });
      
      if (onCommitComplete) {
        onCommitComplete(message, commitHash);
      }

      if (pushToGitHub) {
        setStatus("Enviando para GitHub...");
        await executeCommand('git push origin main');
        toast.success("✅ Commit e push realizados com sucesso!");
      } else {
        toast.success("✅ Commit realizado com sucesso!");
      }

      setCommitMessage("");
      setStatus("Concluído!");
      
      setTimeout(() => {
        setStatus("");
        setIsCommitting(false);
      }, 2000);

    } catch (error) {
      console.error('Erro no commit:', error);
      toast.error(`❌ Erro: ${error.message}`);
      setStatus("");
      setIsCommitting(false);
    }
  };

  const copyCommands = () => {
    const commands = `# Comandos para commit manual:
git add .
git commit -m "sua mensagem aqui"
git push origin main

# Ou use os scripts automatizados:
npm run commit
npm run commit:push`;
    
    navigator.clipboard.writeText(commands);
    toast.success("Comandos copiados para a área de transferência!");
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Auto Commit GitHub
        </CardTitle>
        <CardDescription>
          Facilite o envio de suas alterações para o GitHub
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastCommit && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Último commit:</span>
            </div>
            <div className="text-sm text-green-700 mt-1">
              <div><strong>Hash:</strong> {lastCommit.hash}</div>
              <div><strong>Mensagem:</strong> {lastCommit.message}</div>
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Mensagem do commit (opcional)</label>
          <Textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Deixe em branco para usar mensagem automática..."
            className="min-h-[60px]"
            disabled={isCommitting}
          />
        </div>

        {status && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-800">
              {isCommitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{status}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => handleAutoCommit(false)}
            disabled={isCommitting}
            className="flex-1"
          >
            <GitCommit className="w-4 h-4 mr-2" />
            {isCommitting ? "Processando..." : "Fazer Commit"}
          </Button>
          
          <Button
            onClick={() => handleAutoCommit(true)}
            disabled={isCommitting}
            variant="outline"
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isCommitting ? "Processando..." : "Commit + Push"}
          </Button>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="w-4 h-4" />
            Como usar no Terminal
          </div>
          
          <div className="bg-background rounded p-3 text-xs font-mono space-y-1">
            <div># Fazer commit automático:</div>
            <div className="text-green-600">npm run commit</div>
            <div className="mt-2"># Fazer commit + push:</div>
            <div className="text-green-600">npm run commit:push</div>
          </div>
          
          <Button 
            onClick={copyCommands} 
            variant="outline" 
            size="sm"
            className="w-full"
          >
            📋 Copiar Comandos
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-3">
          <p>⚠️ <strong>Importante:</strong> Esta interface é uma demonstração. Para commits reais, use os comandos no terminal ou execute o script <code>scripts/auto-commit.js</code> diretamente.</p>
        </div>
      </CardContent>
    </Card>
  );
};
