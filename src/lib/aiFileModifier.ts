import { AIRepoScanner, FileModification } from "./aiRepoScanner";
import { GitHubRepo } from "./github";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_CONTEXT_CHARS = 200_000;
const MAX_FILE_CONTENT_CHARS = 40_000;
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
   * Usa IA para analisar o repositório e gerar modificações inteligentes.
   * O agente insiste até entregar código aplicável: se pedir mais arquivos,
   * eles são carregados por completo e o pedido é reenviado automaticamente.
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

      onProgress?.(`📄 ${files.length} arquivos relevantes carregados.`);

      files.sort((a, b) => {
        const isCoreA = a.path.startsWith('src/') || a.path.includes('components') || a.path.includes('pages');
        const isCoreB = b.path.startsWith('src/') || b.path.includes('components') || b.path.includes('pages');
        return (isCoreB ? 1 : 0) - (isCoreA ? 1 : 0);
      });

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        return { message: "❌ Você precisa estar autenticado.", modifications: [] };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const recentHistory = chatHistory.slice(-MAX_CHAT_HISTORY_MESSAGES);

      /** Arquivos carregados por completo sob demanda (prioridade máxima no contexto). */
      const forcedFull = new Map<string, string>();

      const buildContext = () => {
        let totalSize = 0;
        const fileMap: { path: string; content: string }[] = [];
        const fullyLoaded = new Set<string>();
        const partial = new Set<string>();

        const push = (path: string, content: string, allowTruncate: boolean) => {
          const normalized = allowTruncate && content.length > MAX_FILE_CONTENT_CHARS
            ? `${content.slice(0, MAX_FILE_CONTENT_CHARS)}\n\n[arquivo truncado para reduzir consumo de contexto]`
            : content;

          if (totalSize + normalized.length > MAX_FILE_CONTEXT_CHARS) {
            fileMap.push({ path, content: `[arquivo omitido para reduzir consumo de contexto]` });
            partial.add(path);
            return;
          }
          fileMap.push({ path, content: normalized });
          totalSize += normalized.length;
          if (normalized === content) fullyLoaded.add(path);
          else partial.add(path);
        };

        // Primeiro os arquivos pedidos explicitamente pela IA (sempre completos).
        for (const [path, content] of forcedFull) push(path, content, false);
        for (const file of files) {
          if (forcedFull.has(file.path)) continue;
          push(file.path, file.content, true);
        }

        return { fileMap, fullyLoaded, partial };
      };

      const buildSystemPrompt = (ctx: ReturnType<typeof buildContext>) => `Você é um Engenheiro de Software Staff (Nível Principal) trabalhando DIRETAMENTE no repositório conectado, exatamente como o agente do Lovable.
Sua missão é EXECUTAR o pedido do usuário editando o código real — e NUNCA PARAR ATÉ ENTREGAR ALGO MELHOR DO QUE O PEDIDO.

REPOSITÓRIO CONECTADO: ${this.repo.full_name} (branch: ${this.branch})

MANDATO DE EXECUÇÃO (CRÍTICO):
- Você TEM ACESSO TOTAL ao repositório e PODE editar/criar quantos arquivos forem necessários numa única resposta.
- Você NÃO PEDE confirmação e NÃO sugere "posso fazer X?". Você FAZ.
- Qualquer pedido de mudança (ex: "adicione um botão Entrar") DEVE resultar em "modifications" com o arquivo inteiro já alterado.
- Se o arquivo certo não estiver completo abaixo, liste-o em "need_files" e o sistema te devolverá o conteúdo completo na próxima rodada.
- Respostas que apenas explicam, perguntam, ou devolvem 0 modificações para um pedido de ação são FALHAS GRAVES.

REGRAS DE PRECISÃO (OBRIGATÓRIAS — evitam destruir código):
- Só edite arquivos cujo conteúdo COMPLETO está abaixo. Arquivos "[arquivo truncado...]" ou "[arquivo omitido...]" NÃO podem ser reescritos — peça em "need_files".
- Use EXATAMENTE os caminhos como aparecem em "--- ARQUIVO: ..." ou no mapa do repositório. Nunca invente caminhos, nunca prefixe com o nome do repositório nem com "./".
- Cirurgia, não demolição: o "content" é o arquivo inteiro final, idêntico ao original exceto nas partes que o pedido exige mudar. Preserve imports, tipos, comentários e funções existentes.
- Novos componentes/arquivos: use "operation": "create" e também edite o arquivo que os importa, para a mudança ficar visível no app.
- Respeite os padrões do projeto (design tokens, Tailwind, componentes UI já existentes) em vez de inventar estilos novos.
- Não renomeie, mova ou apague arquivos que o pedido não mencionou. Toque no MENOR conjunto de arquivos que resolve o pedido corretamente.

ARQUIVOS CARREGADOS PARA ANÁLISE:
${ctx.fileMap.map(f => `--- ARQUIVO: ${f.path} ---\n${f.content}\n`).join("\n\n")}

ARQUIVOS COM CONTEÚDO COMPLETO (editáveis): ${Array.from(ctx.fullyLoaded).join(", ") || "nenhum"}
ARQUIVOS PARCIAIS (peça em need_files antes de editar): ${Array.from(ctx.partial).join(", ") || "nenhum"}

REGRAS DE RESPOSTA JSON (OBRIGATÓRIO):
- Retorne APENAS o JSON puro, sem markdown e sem texto antes ou depois.
- Formato: { "modifications": [{ "path": "string", "content": "string", "operation": "update"|"create", "message": "string", "reason": "string" }], "summary": "string", "need_files": ["string"] }
- "reason": UMA frase curta em Português explicando o que mudou naquele arquivo (ex: "Adicionado botão Entrar no header ligado à rota /auth").
- "message": mensagem de commit curta e específica.
- "summary": Português Brasileiro, curto e claro, explicando o que foi feito e por quê.`;

      const looksActionable = /\b(corrig|consert|arrum|fix|debug|refator|edit|alter|mud|troc|cri|adicion|inser|coloc|remov|implement|ajust|otimiz|melhor|atualiz|resolv|apli|bot[aã]o|fa[çc]a)\w*/i.test(command);
      let lastText = "";
      let lastUsage: { input_tokens: number; output_tokens: number; cost_cents: number } | undefined;
      let lastProvider: string | undefined;
      let lastSummary = "";
      let lastRejected: string[] = [];

      const MAX_ATTEMPTS = looksActionable ? 4 : 1;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const ctx = buildContext();
        const isLast = attempt === MAX_ATTEMPTS - 1;

        const userPrompt = attempt === 0
          ? command
          : `${command}\n\nSua resposta anterior NÃO entregou código aplicável${lastRejected.length ? ` (problemas: ${lastRejected.slice(0, 5).join("; ")})` : ""}. Os arquivos que você pediu já estão completos no contexto acima. Devolva AGORA apenas o JSON com "modifications" contendo cada arquivo inteiro pronto para salvar. Não explique, não pergunte, não pare até concluir.`;

        const apiMessages = [
          { role: "system", content: buildSystemPrompt(ctx) },
          ...recentHistory.map(m => ({ role: m.role === "ai" ? "assistant" : m.role, content: m.content })),
          { role: "user", content: userPrompt },
        ];

        if (attempt > 0) onProgress?.(`🛠️ Tentativa ${attempt + 1}/${MAX_ATTEMPTS}: insistindo até aplicar a alteração...`);

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
          if (!isLast) { onProgress?.(`⚠️ Erro temporário (${errStr}). Reentrando...`); continue; }
          return { message: `❌ Erro da IA: ${errStr}${triedHint}`, modifications: [] };
        }

        const data = await res.json();
        lastText = data.content || "";
        lastUsage = data.usage;
        lastProvider = data.provider;

        let parsed: { modifications?: unknown[]; summary?: string; need_files?: unknown } | null = null;
        try {
          const jsonMatch = lastText.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : lastText);
        } catch {
          parsed = null;
        }

        if (!parsed) {
          if (!looksActionable || isLast) {
            return { message: lastText, modifications: [], usage: lastUsage, provider: lastProvider };
          }
          lastRejected = ["resposta não veio em JSON válido"];
          continue;
        }

        const raw: FileModification[] = ((parsed.modifications || []) as Record<string, unknown>[]).map((m) => ({
          path: String(m.path || "").trim(),
          content: typeof m.content === "string" ? m.content : "",
          operation: (m.operation === 'create' ? 'create' : 'update') as 'create' | 'update',
          message: String(m.message || `Modificação via IA: ${command.slice(0, 60)}`),
          reason: String(m.reason || m.message || ""),
        }));

        const rejected: string[] = [];
        const retryPaths: string[] = [];
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
            retryPaths.push(cleanPath);
            continue;
          }
          if (ctx.partial.has(cleanPath)) {
            rejected.push(`${cleanPath} (só foi carregado parcialmente — recarregando por completo)`);
            retryPaths.push(cleanPath);
            continue;
          }

          const existsInRepo = this.scanner.knownPaths.includes(cleanPath);
          modifications.push({ ...mod, path: cleanPath, operation: existsInRepo ? 'update' : 'create' });
        }

        lastRejected = rejected;
        lastSummary = String(parsed.summary || "");
        const needFiles: string[] = Array.isArray(parsed.need_files) ? (parsed.need_files as unknown[]).map(String) : [];

        // Sem código aplicável ainda? Carrega o que falta por completo e tenta de novo.
        const missing = Array.from(new Set([...needFiles, ...retryPaths])).filter((p) => !forcedFull.has(p));
        if (modifications.length === 0 && looksActionable && !isLast) {
          if (missing.length) {
            onProgress?.(`📥 Carregando por completo: ${missing.slice(0, 6).join(", ")}`);
            const loaded = await this.scanner.loadFiles(missing);
            loaded.forEach((f) => forcedFull.set(f.path, f.content));
          }
          continue;
        }

        const summary = lastSummary || `${modifications.length} arquivo(s) modificado(s).`;
        const plan = modifications.length
          ? `\n\n**📝 O que estou editando:**\n${modifications.map(m => `- \`${m.path}\` — ${m.operation === 'create' ? 'criar' : 'editar'}: ${m.reason || m.message}`).join("\n")}`
          : "";
        const rejectedNote = rejected.length
          ? `\n\n⚠️ **Ignorei por segurança (${rejected.length}):**\n${rejected.map(r => `- ${r}`).join("\n")}`
          : "";

        modifications.forEach(m => onProgress?.(`✏️ ${m.operation === 'create' ? 'Criando' : 'Editando'} ${m.path}`));

        return { message: `🎯 ${summary}${plan}${rejectedNote}`, modifications, usage: lastUsage, provider: lastProvider };
      }

      return {
        message: lastSummary || lastText || "A IA não devolveu alterações aplicáveis.",
        modifications: [],
        usage: lastUsage,
        provider: lastProvider,
      };

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
