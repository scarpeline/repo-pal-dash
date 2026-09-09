import { getFileContent, updateFile, createFile, getRepoTree, type GitHubRepo } from "@/lib/github";

export interface FileModification {
  path: string;
  content: string;
  operation: 'update' | 'create';
  message: string;
  /** Explicação curta (1 linha) do que foi alterado neste arquivo e por quê. */
  reason?: string;
}

export class AIRepoScanner {
  private token: string;
  private owner: string;
  private repo: string;
  private branch: string;
  /** Todos os caminhos processáveis vistos no último scan (usado para validar caminhos da IA). */
  public knownPaths: string[] = [];
  /** Caminhos cujo conteúdo COMPLETO foi carregado no último scan. */
  public loadedPaths: string[] = [];

  constructor(token: string, repo: GitHubRepo, branch: string = 'main') {
    this.token = token;
    this.owner = repo.owner.login;
    this.repo = repo.name;
    this.branch = branch;
  }

  async scanAllFiles(): Promise<{ path: string; content: string; type: 'file' | 'dir' }[]> {
    try {
      const tree = await getRepoTree(this.token, this.owner, this.repo, this.branch);
      const files: { path: string; content: string; type: 'file' | 'dir' }[] = [];

      const processNode = async (node: any) => {
        const fullPath = node.path;
        
        if (node.type === 'file' && this.shouldProcessFile(fullPath)) {
          try {
            const { content } = await getFileContent(this.token, this.owner, this.repo, fullPath, this.branch);
            files.push({ path: fullPath, content, type: 'file' });
          } catch (error) {
            console.warn(`Could not read file: ${fullPath}`, error);
          }
        } else if (node.type === 'dir' && node.children) {
          // Vamos varrer os diretórios em pequenos blocos paralelos para ser mais rápido (chunks de 5)
          for (let i = 0; i < node.children.length; i += 5) {
            const chunk = node.children.slice(i, i + 5);
            await Promise.all(chunk.map((child: any) => processNode(child)));
          }
        }
      };

      for (const node of tree) {
        await processNode(node);
      }

      return files;
    } catch (error) {
      console.error('Error scanning repository:', error);
      return [];
    }
  }

  async scanRelevantFiles(command: string, maxFiles = 45): Promise<{ path: string; content: string; type: 'file' | 'dir' }[]> {
    const tree = await getRepoTree(this.token, this.owner, this.repo, this.branch);
    const paths: string[] = [];
    const walk = (nodes: any[]) => nodes.forEach((node) => {
      if (node.type === 'file' && this.shouldProcessFile(node.path)) paths.push(node.path);
      if (node.type === 'dir' && node.children) walk(node.children);
    });
    walk(tree);
    this.knownPaths = [...paths];

    const terms = command.toLowerCase().match(/[a-zà-ú0-9_-]{4,}/gi) || [];
    const whiteScreen = /tela\s+branca|white\s*screen|blank/i.test(command);
    // Caminhos/arquivos citados explicitamente no pedido têm prioridade máxima
    const mentioned = (command.match(/[\w./-]+\.(tsx?|jsx?|css|scss|json|md|html|py|php|go|ya?ml|vue|svelte|rs|rb|sh)/gi) || [])
      .map((m) => m.toLowerCase());
    const scorePath = (path: string) => {
      const lower = path.toLowerCase();
      let score = 0;
      for (const m of mentioned) {
        if (lower === m || lower.endsWith(`/${m}`)) score += 500;
        else if (lower.includes(m)) score += 250;
      }
      if (/^(package\.json|vite\.config|index\.html|src\/main|src\/app|src\/pages\/index|src\/pages\/dashboard|src\/contexts\/auth|src\/integrations\/)/i.test(path)) score += 80;
      if (lower.startsWith('src/pages/') || lower.startsWith('src/components/') || lower.startsWith('src/hooks/') || lower.startsWith('src/lib/')) score += 30;
      if (whiteScreen && /app|main|index|router|route|auth|layout|error|callback|vite|package/.test(lower)) score += 70;
      for (const term of terms) if (lower.includes(term.toLowerCase())) score += 18;
      if (/test|spec|stories|README|CHANGELOG/i.test(path)) score -= 20;
      return score;
    };

    const selected = paths
      .sort((a, b) => scorePath(b) - scorePath(a))
      .slice(0, Math.min(maxFiles, paths.length));

    const files: { path: string; content: string; type: 'file' | 'dir' }[] = [{
      path: '_REPOSITORY_MAP.md',
      type: 'file',
      content: `Arquivos processáveis no repositório (${paths.length}):\n${paths.slice(0, 600).map((p) => `- ${p}`).join('\n')}`,
    }];

    for (let i = 0; i < selected.length; i += 6) {
      const chunk = selected.slice(i, i + 6);
      const loaded = await Promise.all(chunk.map(async (path) => {
        try {
          const { content } = await getFileContent(this.token, this.owner, this.repo, path, this.branch);
          return { path, content, type: 'file' as const };
        } catch (error) {
          console.warn(`Could not read file: ${path}`, error);
          return null;
        }
      }));
      files.push(...loaded.filter(Boolean) as { path: string; content: string; type: 'file' | 'dir' }[]);
    }

    this.loadedPaths = files.filter((f) => f.path !== '_REPOSITORY_MAP.md').map((f) => f.path);
    return files;
  }

  private shouldProcessFile(path: string): boolean {
    const extensions = [
      '.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.json', '.md', '.html',
      '.py', '.php', '.java', '.go', '.yml', '.yaml', '.xml', '.vue', '.svelte',
      '.txt', '.toml', '.rs', '.c', '.cpp', '.h', '.rb', '.sh', '.env', '.config'
    ];
    const excludePatterns = ['node_modules', '.git', 'dist', 'build', '.next', 'package-lock', 'bun.lock'];
    
    return extensions.some(ext => path.endsWith(ext)) && 
           !excludePatterns.some(pattern => path.includes(pattern));
  }

  async applyModifications(
    modifications: FileModification[],
    onProgress?: (msg: string) => void
  ): Promise<{ success: string[]; errors: string[] }> {
    const results: { success: string[]; errors: string[] } = { success: [], errors: [] };

    let index = 0;
    for (const mod of modifications) {
      index += 1;
      onProgress?.(`💾 (${index}/${modifications.length}) Salvando ${mod.path}...`);
      try {
        const { getFileSha } = await import("@/lib/github");
        
        let currentSha: string | undefined;
        try {
          // Sempre tentamos pegar o SHA atual do arquivo, independente do que a IA disse.
          // Se o arquivo já existe no Github, ele VAI precisar do SHA para ser alterado.
          currentSha = await getFileSha(this.token, this.owner, this.repo, mod.path, this.branch);
        } catch (e) {
          // Se falhou (404 Not Found), significa que o arquivo não existe, então currentSha será undefined e podemos prosseguir criando.
        }

        if (currentSha) {
          await updateFile(this.token, this.owner, this.repo, mod.path, mod.content, mod.message, currentSha, this.branch);
        } else {
          await createFile(this.token, this.owner, this.repo, mod.path, mod.content, mod.message, this.branch);
        }
        
        results.success.push(`✅ ${mod.path}: Salvo com sucesso no GitHub.`);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`❌ ${mod.path}: ${errMsg}`);
      }
    }

    return results;
  }

  async searchPattern(pattern: RegExp, fileExtensions?: string[]): Promise<{ path: string; matches: string[] }[]> {
    const files = await this.scanAllFiles();
    const results: { path: string; matches: string[] }[] = [];

    for (const file of files) {
      if (fileExtensions && !fileExtensions.some(ext => file.path.endsWith(ext))) continue;
      const matches = file.content.match(pattern);
      if (matches) {
        results.push({ path: file.path, matches: matches.slice(0, 5) });
      }
    }

    return results;
  }
}
