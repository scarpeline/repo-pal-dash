import { AIRepoScanner, FileModification } from "./aiRepoScanner";
import { GitHubRepo } from "./github";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_CONTEXT_CHARS = 120_000;
const MAX_FILE_CONTENT_CHARS = 12_000;
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
    model: string = "auto",
    onProgress?: (msg: string) => void,
    chatHistory: { role: string; content: string }[] = []
  ): Promise<{ message: string; modifications: FileModification[]; usage?: { input_tokens: number; output_tokens: number; cost_cents: number }; provider?: string }> {
    try {
      onProgress?.("📁 Mapeando o repositório conectado...");
      const files = await this.scanner.scanRelevantFiles(command);

      if (files.length === 0) {
        return { message: "❌ Nenhum arquivo encontrado no repositório.", modifications: [] };
      }

      onProgress?.(`📄 ${files.length} arquivos relevantes carregados. Montando contexto econômico...`);

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
`).join("\n\n")}

REGRAS OBRIGATÓRIAS DE RESPOSTA FORMATO JSON:
1. Sua única resposta deve ser EXCLUSIVAMENTE um objeto JSON válido, sem usar blocos de markdown como \`\`\`json.
2. O formato obrigatório do JSON: { "modifications": [...], "summary": "sua resposta em texto para o usuário, no papel de desenvolvedor." }
3. Se o usuário pedir para alterar, adicionar ou corrigir algo no projeto, preencha o array "modifications".
4. Cada objeto em "modifications" deve ser: { "path": "caminho/do/arquivo", "content": "CÓDIGO COMPLETO SUBSTITUTO", "operation": "update" ou "create", "message": "descrição do commit" }.
5. "content" DEVE SEMPRE conter o CÓDIGO FONTE COMPLETO do arquivo após sua modificação. Nunca resuma com reticências.
6. Se a solicitação do usuário for apenas uma dúvida, ou se nenhuma modificação com código for necessária, retorne "modifications": [] e escreva a resposta explicativa no campo "summary".
7. Seja natural no campo "summary", conversando em Português do Brasil de forma prestativa e direta.
8. NUNCA peça para o usuário enviar App.tsx, logs, código ou arquivos quando o repositório já foi conectado. Você já recebeu mapa e arquivos relevantes; analise-os e aja.
9. Se a causa não estiver 100% comprovada, faça a melhor correção segura com base no repositório e explique objetivamente no "summary".
10. Se o MODO CORREÇÃO AUTOMÁTICA estiver ativado, você tem liberdade total para corrigir bugs colaterais encontrados no mapa do repositório.
11. Para tela branca, erro de login, build quebrado, roteamento, imports, hooks e runtime, procure primeiro em App/main/routes/auth/components e gere modificações quando encontrar qualquer correção plausível.
12. Se a mensagem do usuário contiver comandos como corrija, aplique, faça, implemente, ajuste, crie, edite, melhore ou resolver, você DEVE devolver pelo menos uma modificação quando houver qualquer arquivo relevante no contexto. Não pare apenas explicando o que faria.`;

      const looksActionable = /\b(corrig|consert|arrum|fix|debug|refator|edit|alter|mud|troc|cri|adicion|remov|implement|ajust|otimiz|melhor|atualiz|resolv|apli|fa[çc]a|tela\s+branca|white\s*screen)\b/i.test(command);
      let lastText = "";
      let lastUsage: any;
      let lastProvider: string | undefined;

      for (let attempt = 0; attempt < (looksActionable ? 2 : 1); attempt++) {
        const apiMessages = [
          { role: "system", content: systemPrompt },
          ...recentHistory.map(m => ({ role: m.role === "ai" ? "assistant" : m.role, content: m.content })),
          { role: "user", content: attempt === 0 ? command : `${command}\n\nSua resposta anterior parou em explicação. Continue até o fim: devolva JSON com modifications contendo os arquivos completos alterados.` }
        ];

        if (attempt > 0) onProgress?.("🛠️ Continuando automaticamente até gerar alterações aplicáveis...");

        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ messages: apiMessages, repoName: this.repo.full_name, branch: this.branch, model }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({} as Record<string, unknown>));
          const errStr = String((errData as { error?: string }).error || res.status);
          const tried = (errData as { tried_models?: string[] }).tried_models;
          const triedHint = tried && tried.length > 1 ? ` Tentados: ${tried.join(", ")}.` : "";
          return { message: `❌ Erro da IA: ${errStr}${triedHint}`, modifications: [] };
        }

        const data = await res.json();
        lastText = data.content || "";
        lastUsage = data.usage;
        lastProvider = data.provider;

        try {
          let jsonStr = lastText;
          const jsonMatch = lastText.match(/\{[\s\S]*\}/);
          if (jsonMatch) jsonStr = jsonMatch[0];
          const parsed = JSON.parse(jsonStr);
          const modifications: FileModification[] = (parsed.modifications || []).map((m: any) => ({ path: m.path, content: m.content, operation: m.operation || 'update', message: m.message || `Modificação via IA: ${command}` }));
          const summary = parsed.summary || `${modifications.length} arquivo(s) para modificar.`;
          if (modifications.length > 0 || !looksActionable || attempt === 1) return { message: `🎯 ${summary}`, modifications, usage: lastUsage, provider: lastProvider };
        } catch {
          if (!looksActionable || attempt === 1) return { message: lastText, modifications: [], usage: lastUsage, provider: lastProvider };
        }
      }

      return { message: lastText || "A IA não devolveu alterações aplicáveis.", modifications: [], usage: lastUsage, provider: lastProvider };

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
