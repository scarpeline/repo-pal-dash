import { AIRepoScanner, FileModification } from "./aiRepoScanner";
import { GitHubRepo } from "./github";
import { supabase } from "@/integrations/supabase/client";

export class AIFileModifier {
  private scanner: AIRepoScanner;
  private repo: GitHubRepo;
  private branch: string;

  constructor(token: string, repo: GitHubRepo, branch: string = 'main') {
    this.scanner = new AIRepoScanner(token, repo, branch);
    this.repo = repo;
    this.branch = branch;
  }

  /**
   * Usa IA para analisar o repositório e gerar modificações inteligentes
   */
  async processCommand(
    command: string,
    model: string = "google/gemini-2.5-flash",
    onProgress?: (msg: string) => void
  ): Promise<{ message: string; modifications: FileModification[] }> {
    try {
      onProgress?.("📁 Varrendo arquivos do repositório...");
      const files = await this.scanner.scanAllFiles();

      if (files.length === 0) {
        return { message: "❌ Nenhum arquivo encontrado no repositório.", modifications: [] };
      }

      onProgress?.(`📄 ${files.length} arquivos encontrados. Analisando com IA...`);

      // Build a compact file map for the AI (limit to ~50KB to avoid token overflow)
      let totalSize = 0;
      const fileMap: { path: string; content: string }[] = [];
      for (const f of files) {
        if (totalSize + f.content.length > 50000) {
          // Include path only for remaining files
          fileMap.push({ path: f.path, content: `[arquivo muito grande - ${f.content.length} chars]` });
        } else {
          fileMap.push({ path: f.path, content: f.content });
          totalSize += f.content.length;
        }
      }

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        return { message: "❌ Você precisa estar autenticado.", modifications: [] };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const systemPrompt = `Você é um assistente de programação expert. O usuário quer modificar um repositório GitHub.
Analise os arquivos do repositório e gere as modificações necessárias.

REPOSITÓRIO: ${this.repo.full_name} (branch: ${this.branch})

ARQUIVOS DO REPOSITÓRIO:
${fileMap.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n')}

REGRAS:
1. Responda APENAS com um JSON válido, sem markdown, sem \`\`\`
2. O JSON deve ter o formato: { "modifications": [...], "summary": "..." }
3. Cada modificação: { "path": "caminho/do/arquivo", "content": "conteúdo completo do arquivo modificado", "operation": "update" ou "create", "message": "descrição da mudança" }
4. Para "update", envie o conteúdo COMPLETO do arquivo modificado
5. Para "create", envie o conteúdo completo do novo arquivo
6. Se não encontrar o que modificar, retorne: { "modifications": [], "summary": "explicação" }
7. Seja preciso e mantenha o código funcional`;

      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: command }],
          repoName: this.repo.full_name,
          branch: this.branch,
          model,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { message: `❌ Erro da IA: ${errData.error || res.status}`, modifications: [] };
      }

      const data = await res.json();
      const aiContent = data.content || "";

      // Parse JSON from AI response
      try {
        // Try to extract JSON from the response
        let jsonStr = aiContent;
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr);
        const modifications: FileModification[] = (parsed.modifications || []).map((m: any) => ({
          path: m.path,
          content: m.content,
          operation: m.operation || 'update',
          message: m.message || `Modificação via IA: ${command}`,
        }));

        const summary = parsed.summary || `${modifications.length} arquivo(s) para modificar.`;
        return { message: `🎯 ${summary}`, modifications };
      } catch {
        // AI didn't return valid JSON, return the text as explanation
        return { message: aiContent, modifications: [] };
      }

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { message: `❌ Erro ao processar comando: ${errMsg}`, modifications: [] };
    }
  }

  async executeModifications(modifications: FileModification[]): Promise<string> {
    if (modifications.length === 0) {
      return "❌ Nenhuma modificação para aplicar.";
    }

    const results = await this.scanner.applyModifications(modifications);
    
    let message = `🚀 **Modificações Aplicadas!**\n\n`;
    
    if (results.success.length > 0) {
      message += `✅ **Sucesso (${results.success.length}):**\n`;
      results.success.forEach(s => { message += `   ${s}\n`; });
    }

    if (results.errors.length > 0) {
      message += `\n❌ **Erros (${results.errors.length}):**\n`;
      results.errors.forEach(e => { message += `   ${e}\n`; });
    }

    return message;
  }
}
