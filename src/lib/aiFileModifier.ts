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
      const fullyLoaded = new Set<string>();
      const partial = new Set<string>();

      for (const file of files) {
        const normalizedContent = file.content.length > MAX_FILE_CONTENT_CHARS
          ? `${file.content.slice(0, MAX_FILE_CONTENT_CHARS)}

[arquivo truncado para reduzir consumo de contexto]`
          : file.content;

        if (totalSize + normalizedContent.length > MAX_FILE_CONTEXT_CHARS) {
          fileMap.push({ path: file.path, content: `[arquivo omitido para reduzir consumo de contexto]` });
          partial.add(file.path);
          continue;
        }

        fileMap.push({ path: file.path, content: normalizedContent });
        totalSize += normalizedContent.length;
        if (normalizedContent === file.content) fullyLoaded.add(file.path);
        else partial.add(file.path);
      }

      onProgress?.(`🔎 Contexto pronto: ${fullyLoaded.size} arquivo(s) com conteúdo completo${partial.size ? `, ${partial.size} parcial(is)` : ""}.`);

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        return { message: "❌ Você precisa estar autenticado.", modifications: [] };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const recentHistory = chatHistory.slice(-MAX_CHAT_HISTORY_MESSAGES);

      const systemPrompt = `Você é um Engenheiro de Software Staff (Nível Principal) com capacidade de arquitetura de sistemas.
Sua missão é agir como o cérebro do projeto, resolvendo problemas complexos de forma autônoma — e NUNCA PARAR ATÉ ENTREGAR ALGO MELHOR DO QUE O PEDIDO.

REPOSITÓRIO CONECTADO: ${this.repo.full_name} (branch: ${this.branch})

MANDATO DE EXECUÇÃO PERSISTENTE (CRÍTICO):
- Você TEM ACESSO TOTAL ao repositório acima e PODE editar quantos arquivos forem necessários numa única resposta.
- Você NÃO PEDE confirmação. NÃO sugere "posso fazer X?". Você FAZ.
- Se a tarefa exige tocar 1 arquivo, toque 1. Se exige tocar 30, toque 30 — entregue tudo numa só resposta.
- Você só termina quando o pedido está 100% completo + melhorias seguras adicionais aplicadas (segurança, performance, UX, acessibilidade, tipos, imports, código morto).
- Respostas que apenas explicam, perguntam, ou devolvem 0 modificações para um pedido de ação são FALHAS GRAVES.

REGRAS DE PRECISÃO (OBRIGATÓRIAS — evitam destruir código):
- Só edite arquivos cujo conteúdo COMPLETO está abaixo. Arquivos marcados como "[arquivo truncado...]" ou "[arquivo omitido...]" NÃO podem ser reescritos: se precisar deles, explique no "summary" e peça no campo "need_files".
- Use EXATAMENTE os caminhos como aparecem em "--- ARQUIVO: ..." ou no mapa do repositório. Nunca invente caminhos, nunca prefixe com o nome do repositório nem com "./".
- Cirurgia, não demolição: preserve todo o código não relacionado ao pedido (imports, tipos, comentários, funções existentes). O "content" é o arquivo inteiro final, idêntico ao original exceto nas partes que o pedido exige mudar.
- Não renomeie, mova ou apague arquivos que o pedido não mencionou.
- Toque no MENOR conjunto de arquivos que resolve o pedido de forma correta.

INSTRUÇÕES DE EXECUÇÃO ELITE:
1. ANÁLISE SISTÊMICA: Olhe para o projeto como um todo. Verifique o tema global, design tokens, variáveis CSS/Tailwind antes de mexer em estilos.
2. RESOLUÇÃO DE CAUSA RAIZ: Se há um bug, conserte na raiz, não esconda o sintoma.
3. CONTEXTO DE ARQUIVOS: Abaixo estão os arquivos relevantes. Use-os para inferir padrões de código.
4. MODIFICAÇÕES COMPLETAS: NUNCA código parcial. O campo "content" deve ser o arquivo INTEIRO pronto para salvar.
5. AUTONOMIA TOTAL: Corrija qualquer inconsistência colateral que encontrar enquanto trabalha.
6. ENTREGA SUPERIOR: Sempre adicione 1 ou 2 melhorias além do pedido (ex: melhor acessibilidade, loading state, tratamento de erro, comentários úteis) e mencione no "summary".

ARQUIVOS CARREGADOS PARA ANÁLISE:
${fileMap.map(f => `--- ARQUIVO: ${f.path} ---
${f.content}
`).join("\n\n")}

ARQUIVOS COM CONTEÚDO COMPLETO (editáveis): ${Array.from(fullyLoaded).join(", ") || "nenhum"}
ARQUIVOS PARCIAIS (NÃO reescrever): ${Array.from(partial).join(", ") || "nenhum"}

REGRAS DE RESPOSTA JSON (OBRIGATÓRIO):
- Retorne APENAS o JSON puro.
- Formato: { "modifications": [{ "path": "string", "content": "string", "operation": "update"|"create", "message": "string", "reason": "string" }], "summary": "string", "need_files": ["string"] }
- "reason": UMA frase curta em Português explicando o que mudou naquele arquivo (ex: "Corrigido import quebrado do AuthContext que causava tela branca").
- "message": mensagem de commit curta e específica.
- "summary" deve ser em Português Brasileiro, curto e claro, explicando o "porquê" das decisões técnicas.
- Se o usuário der uma ordem (corrija, mude, adicione), você DEVE preencher o array "modifications". Explicações sem código para pedidos de ação serão consideradas falhas de execução.`;

      const looksActionable = /\b(corrig|consert|arrum|fix|debug|refator|edit|alter|mud|troc|cri|adicion|remov|implement|ajust|otimiz|melhor|atualiz|resolv|apli|fa[çc]a|tela\s+branca|white\s*screen)\b/i.test(command);
      let lastText = "";
      let lastUsage: any;
      let lastProvider: string | undefined;

      const MAX_ATTEMPTS = looksActionable ? 4 : 1;
      const retryPrompts = [
        command,
        `${command}\n\nSua resposta anterior parou em explicação. Continue ATÉ O FIM: devolva JSON puro com "modifications" contendo TODOS os arquivos completos alterados. Nada de explicações antes do JSON.`,
        `${command}\n\nVocê ainda não entregou. Lembre-se: você tem acesso total ao repositório. Aplique TODAS as alterações necessárias agora — arquivos completos no campo "content". Não pare até concluir.`,
        `${command}\n\nÚltima tentativa. Devolva APENAS o JSON { "modifications": [...], "summary": "..." } com cada arquivo pronto para salvar. Inclua melhorias seguras adicionais (correções de bugs, acessibilidade, performance leve). NÃO entregue resposta vazia.`,
      ];

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const apiMessages = [
          { role: "system", content: systemPrompt },
          ...recentHistory.map(m => ({ role: m.role === "ai" ? "assistant" : m.role, content: m.content })),
          { role: "user", content: retryPrompts[Math.min(attempt, retryPrompts.length - 1)] }
        ];

        if (attempt > 0) onProgress?.(`🛠️ Tentativa ${attempt + 1}/${MAX_ATTEMPTS}: insistindo até concluir o pedido...`);

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
          if (attempt < MAX_ATTEMPTS - 1) { onProgress?.(`⚠️ Erro temporário (${errStr}). Reentrando...`); continue; }
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
          const raw: FileModification[] = (parsed.modifications || []).map((m: any) => ({
            path: String(m.path || "").trim(),
            content: typeof m.content === "string" ? m.content : "",
            operation: (m.operation === 'create' ? 'create' : 'update') as 'create' | 'update',
            message: m.message || `Modificação via IA: ${command.slice(0, 60)}`,
            reason: m.reason || m.message || "",
          }));

          const rejected: string[] = [];
          const modifications: FileModification[] = [];

          for (const mod of raw) {
            const cleanPath = mod.path
              .replace(/^\.\//, "")
              .replace(new RegExp(`^${this.repo.full_name}/`), "")
              .replace(new RegExp(`^${this.repo.name}/`), "")
              .replace(/^\/+/, "");

            if (!cleanPath) { rejected.push("caminho vazio"); continue; }
            if (!mod.content.trim()) { rejected.push(`${cleanPath} (conteúdo vazio)`); continue; }
            if (/\[arquivo (truncado|omitido)/i.test(mod.content) || /\.\.\.\s*(resto|restante|mantenha|keep)/i.test(mod.content)) {
              rejected.push(`${cleanPath} (código incompleto devolvido pela IA)`);
              continue;
            }
            if (partial.has(cleanPath)) {
              rejected.push(`${cleanPath} (só foi carregado parcialmente — não posso reescrever com segurança)`);
              continue;
            }

            const existsInRepo = this.scanner.knownPaths.includes(cleanPath);
            modifications.push({ ...mod, path: cleanPath, operation: existsInRepo ? 'update' : 'create' });
          }

          const summary = parsed.summary || `${modifications.length} arquivo(s) para modificar.`;
          const plan = modifications.length
            ? `\n\n**📝 O que estou editando:**\n${modifications.map(m => `- \`${m.path}\` — ${m.operation === 'create' ? 'criar' : 'editar'}: ${m.reason || m.message}`).join("\n")}`
            : "";
          const rejectedNote = rejected.length
            ? `\n\n⚠️ **Ignorei por segurança (${rejected.length}):**\n${rejected.map(r => `- ${r}`).join("\n")}`
            : "";
          const needFiles: string[] = Array.isArray(parsed.need_files) ? parsed.need_files : [];
          const needNote = needFiles.length
            ? `\n\n📎 A IA pediu mais contexto destes arquivos: ${needFiles.slice(0, 8).join(", ")}`
            : "";

          modifications.forEach(m => onProgress?.(`✏️ ${m.operation === 'create' ? 'Criando' : 'Editando'} ${m.path}`));

          if (modifications.length > 0 || !looksActionable || attempt === MAX_ATTEMPTS - 1) {
            return { message: `🎯 ${summary}${plan}${rejectedNote}${needNote}`, modifications, usage: lastUsage, provider: lastProvider };
          }
        } catch {
          if (!looksActionable || attempt === MAX_ATTEMPTS - 1) return { message: lastText, modifications: [], usage: lastUsage, provider: lastProvider };
        }
      }

      return { message: lastText || "A IA não devolveu alterações aplicáveis.", modifications: [], usage: lastUsage, provider: lastProvider };

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { message: `❌ Erro ao processar comando: ${errMsg}`, modifications: [] };
    }
  }

  async executeModifications(
    modifications: FileModification[],
    onProgress?: (msg: string) => void
  ): Promise<string> {
    if (modifications.length === 0) {
      return "❌ Nenhuma modificação para aplicar.";
    }

    const results = await this.scanner.applyModifications(modifications, onProgress);
    
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
