import { AIRepoScanner, FileModification } from "./aiRepoScanner";
import { GitHubRepo } from "./github";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_CONTEXT_CHARS = 350_000;
const MAX_FILE_CONTENT_CHARS = 20_000;
const MAX_CHAT_HISTORY_MESSAGES = 8;

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
    model: string = "gemini",
    onProgress?: (msg: string) => void,
    chatHistory: { role: string; content: string }[] = []
  ): Promise<{ message: string; modifications: FileModification[] }> {
    try {
      onProgress?.("📁 Varrendo e analisando arquivos relevantes...");
      const files = await this.scanner.scanAllFiles();

      if (files.length === 0) {
        return { message: "❌ Nenhum arquivo encontrado no repositório.", modifications: [] };
      }

      onProgress?.(`📄 ${files.length} arquivos encontrados. Montando contexto otimizado...`);

      files.sort((a, b) => {
        const isCoreA = a.path.startsWith('src/') || a.path.includes('components') || a.path.includes('pages');
        const isCoreB = b.path.startsWith('src/') || b.path.includes('components') || b.path.includes('pages');
        return (isCoreB ? 1 : 0) - (isCoreA ? 1 : 0);
      });

      let totalSize = 0;
      const fileMap: { path: string; content: string }[] = [];

      for (const file of files) {
        const normalizedContent = file.content.length > MAX_FILE_CONTENT_CHARS
          ? `${file.content.slice(0, MAX_FILE_CONTENT_CHARS)}

[arquivo truncado para reduzir consumo de contexto]`
          : file.content;

        if (totalSize + normalizedContent.length > MAX_FILE_CONTEXT_CHARS) {
          fileMap.push({ path: file.path, content: `[arquivo omitido para reduzir consumo de contexto]` });
          continue;
        }

        fileMap.push({ path: file.path, content: normalizedContent });
        totalSize += normalizedContent.length;
      }

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        return { message: "❌ Você precisa estar autenticado.", modifications: [] };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const recentHistory = chatHistory.slice(-MAX_CHAT_HISTORY_MESSAGES);

      const systemPrompt = `Você é um Engenheiro de Software Autônomo nível Staff (como o Claude Code / Antigravity).
Sua missão é resolver o problema do usuário analisando o código e fazendo modificações automaticamente quando necessário, ou apenas tirando dúvidas.

REPOSITÓRIO: ${this.repo.full_name} (branch: ${this.branch})

ARQUIVOS DO REPOSITÓRIO:
${fileMap.map(f => `--- ${f.path} ---
${f.content}
`).join('
')}

REGRAS OBRIGATÓRIAS DE RESPOSTA FORMATO JSON:
1. Sua única resposta deve ser EXCLUSIVAMENTE um objeto JSON válido, sem usar blocos de markdown como \`\`\`json.
2. O formato obrigatório do JSON: { "modifications": [...], "summary": "sua resposta em texto para o usuário, no papel de desenvolvedor." }
3. Se o usuário pedir para alterar, adicionar ou corrigir algo no projeto, preencha o array "modifications".
4. Cada objeto em "modifications" deve ser: { "path": "caminho/do/arquivo", "content": "CÓDIGO COMPLETO SUBSTITUTO", "operation": "update" ou "create", "message": "descrição do commit" }.
5. "content" DEVE SEMPRE conter o CÓDIGO FONTE COMPLETO do arquivo após sua modificação. Nunca resuma com reticências.
6. Se a solicitação do usuário for apenas uma dúvida, ou se nenhuma modificação com código for necessária, retorne "modifications": [] e escreva a resposta explicativa no campo "summary".
7. Seja natural no campo "summary", conversando em Português do Brasil de forma prestativa e direta.`;

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...recentHistory.map(m => ({ role: m.role === "ai" ? "assistant" : m.role, content: m.content })),
        { role: "user", content: command }
      ];

      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
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

      try {
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
    
    let message = `🚀 **Modificações Aplicadas!**

`;
    
    if (results.success.length > 0) {
      message += `✅ **Sucesso (${results.success.length}):**
`;
      results.success.forEach(s => { message += `   ${s}
`; });
    }

    if (results.errors.length > 0) {
      message += `
❌ **Erros (${results.errors.length}):**
`;
      results.errors.forEach(e => { message += `   ${e}
`; });
    }

    return message;
  }
}
