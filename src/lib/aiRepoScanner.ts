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

  /**
   * Varre todos os arquivos do repositório
   */
  async scanAllFiles(): Promise<{ path: string; content: string; type: 'file' | 'dir' }[]> {
    try {
      const tree = await getRepoTree(this.token, this.owner, this.repo, this.branch);
      const files: { path: string; content: string; type: 'file' | 'dir' }[] = [];

      const processNode = async (node: any, basePath: string = '') => {
        const fullPath = basePath ? `${basePath}/${node.path}` : node.path;
        
        if (node.type === 'file' && this.shouldProcessFile(fullPath)) {
          try {
            const content = await getFileContent(this.token, this.owner, this.repo, fullPath, this.branch);
            files.push({
              path: fullPath,
              content,
              type: 'file'
            });
          } catch (error) {
            console.warn(`Could not read file: ${fullPath}`, error);
          }
        } else if (node.type === 'dir' && node.children) {
          for (const child of node.children) {
            await processNode(child, fullPath);
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

  /**
   * Verifica se o arquivo deve ser processado
   */
  private shouldProcessFile(path: string): boolean {
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.json', '.md'];
    const excludePatterns = ['node_modules', '.git', 'dist', 'build', '.next'];
    
    return extensions.some(ext => path.endsWith(ext)) && 
           !excludePatterns.some(pattern => path.includes(pattern));
  }

  /**
   * Aplica modificações no repositório
   */
  async applyModifications(modifications: FileModification[]): Promise<{ success: string[]; errors: string[] }> {
    const results = { success: [], errors: [] };

    for (const mod of modifications) {
      try {
        if (mod.operation === 'update') {
          // Para update, precisamos do SHA atual
          const { getFileSha } = await import("@/lib/github");
          const sha = await getFileSha(this.token, this.owner, this.repo, mod.path, this.branch);
          await updateFile(this.token, this.owner, this.repo, mod.path, mod.content, mod.message, sha, this.branch);
        } else if (mod.operation === 'create') {
          await createFile(this.token, this.owner, this.repo, mod.path, mod.content, mod.message, this.branch);
        }
        
        results.success.push(`✅ ${mod.path}: ${mod.message}`);
      } catch (error) {
        results.errors.push(`❌ ${mod.path}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Busca por padrões de código nos arquivos
   */
  async searchPattern(pattern: RegExp, fileExtensions?: string[]): Promise<{ path: string; matches: string[] }[]> {
    const files = await this.scanAllFiles();
    const results: { path: string; matches: string[] }[] = [];

    for (const file of files) {
      if (fileExtensions && !fileExtensions.some(ext => file.path.endsWith(ext))) {
        continue;
      }

      const matches = file.content.match(pattern);
      if (matches) {
        results.push({
          path: file.path,
          matches: matches.slice(0, 5) // Limitar a 5 matches por arquivo
        });
      }
    }

    return results;
  }
}
