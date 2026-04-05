import { getFileContent, updateFile, createFile, getRepoTree, type GitHubRepo } from "@/lib/github";

export interface FileModification {
  path: string;
  content: string;
  operation: 'update' | 'create';
  message: string;
}

export class AIRepoScanner {
  private token: string;
  private owner: string;
  private repo: string;
  private branch: string;

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

  private shouldProcessFile(path: string): boolean {
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.json', '.md', '.html'];
    const excludePatterns = ['node_modules', '.git', 'dist', 'build', '.next', 'package-lock', 'bun.lock'];
    
    return extensions.some(ext => path.endsWith(ext)) && 
           !excludePatterns.some(pattern => path.includes(pattern));
  }

  async applyModifications(modifications: FileModification[]): Promise<{ success: string[]; errors: string[] }> {
    const results: { success: string[]; errors: string[] } = { success: [], errors: [] };

    for (const mod of modifications) {
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
