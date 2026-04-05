import { AIRepoScanner, FileModification } from "./aiRepoScanner";
import { GitHubRepo } from "./github";

export class AIFileModifier {
  private scanner: AIRepoScanner;

  constructor(token: string, repo: GitHubRepo, branch: string = 'main') {
    this.scanner = new AIRepoScanner(token, repo, branch);
  }

  /**
   * Processa comando em linguagem natural e modifica arquivos
   */
  async processCommand(command: string): Promise<{ message: string; modifications: FileModification[] }> {
    try {
      // Analisar o comando para determinar a ação
      const analysis = this.analyzeCommand(command);
      
      if (!analysis.action) {
        return { message: "❌ Não consegui entender o comando. Tente ser mais específico.", modifications: [] };
      }

      // Executar a ação correspondente
      let modifications: FileModification[] = [];

      switch (analysis.action) {
        case 'change_color':
          modifications = await this.changeColor(analysis.target!, analysis.color!);
          break;
        case 'change_text':
          modifications = await this.changeText(analysis.target!, analysis.oldText!, analysis.newText!);
          break;
        case 'add_component':
          modifications = await this.addComponent(analysis.target!, analysis.component!);
          break;
        case 'fix_bug':
          modifications = await this.fixBug(analysis.description!);
          break;
        case 'update_style':
          modifications = await this.updateStyle(analysis.target!, analysis.style!);
          break;
        default:
          return { message: "❌ Comando não reconhecido.", modifications: [] };
      }

      if (modifications.length === 0) {
        return { message: "❌ Não encontrei arquivos para modificar.", modifications: [] };
      }

      return { 
        message: `🎯 Encontrei ${modifications.length} arquivo(s) para modificar.`, 
        modifications 
      };

    } catch (error) {
      return { 
        message: `❌ Erro ao processar comando: ${error.message}`, 
        modifications: [] 
      };
    }
  }

  /**
   * Analisa o comando em linguagem natural
   */
  private analyzeCommand(command: string) {
    const analysis: any = {};

    // Detectar mudança de cor
    const colorMatch = command.match(/mud[aá]|altera|troca.*cor.*?(do?|da?)?\s*(.+?)\s*(para|para\s*a\s*cor)?\s*(.+)/i);
    if (colorMatch) {
      analysis.action = 'change_color';
      analysis.target = colorMatch[2].trim();
      analysis.color = colorMatch[4].trim();
    }

    // Detectar mudança de texto
    const textMatch = command.match(/(mud[aá]|altera|troca).*?texto.*?(do?|da?)?\s*(.+?)\s*(para|por)\s*(.+)/i);
    if (textMatch) {
      analysis.action = 'change_text';
      analysis.target = textMatch[2].trim();
      analysis.oldText = textMatch[2].trim();
      analysis.newText = textMatch[4].trim();
    }

    // Detectar adição de componente
    const componentMatch = command.match(/(adiciona|cria|inclui).*?(componente|elemento)?\s*(.+)/i);
    if (componentMatch) {
      analysis.action = 'add_component';
      analysis.target = 'app';
      analysis.component = componentMatch[2].trim();
    }

    // Detectar correção de bug
    const bugMatch = command.match(/(corrige|conserta|arruma|fix).*?(bug|erro|problema)?\s*(.+)/i);
    if (bugMatch) {
      analysis.action = 'fix_bug';
      analysis.description = bugMatch[2].trim();
    }

    // Detectar atualização de estilo
    const styleMatch = command.match(/(atualiza|melhora|estiliza).*?(estilo|css|design)?\s*(do?|da?)?\s*(.+)/i);
    if (styleMatch) {
      analysis.action = 'update_style';
      analysis.target = styleMatch[3].trim();
      analysis.style = styleMatch[3].trim();
    }

    return analysis;
  }

  /**
   * Altera cores de elementos específicos
   */
  private async changeColor(target: string, color: string): Promise<FileModification[]> {
    const files = await this.scanner.scanAllFiles();
    const modifications: FileModification[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.jsx')) continue;

      let modified = false;
      let newContent = file.content;

      // Mapear cores comuns para classes Tailwind
      const colorMap: { [key: string]: string } = {
        'azul': 'bg-blue-500 hover:bg-blue-600 text-blue-600',
        'vermelho': 'bg-red-500 hover:bg-red-600 text-red-600',
        'verde': 'bg-green-500 hover:bg-green-600 text-green-600',
        'amarelo': 'bg-yellow-500 hover:bg-yellow-600 text-yellow-600',
        'roxo': 'bg-purple-500 hover:bg-purple-600 text-purple-600',
        'cinza': 'bg-gray-500 hover:bg-gray-600 text-gray-600',
        'preto': 'bg-black hover:bg-gray-800 text-black',
        'branco': 'bg-white hover:bg-gray-100 text-white'
      };

      const colorClass = colorMap[color.toLowerCase()] || `bg-${color}-500`;

      // Procurar por botões e elementos interativos
      if (target.toLowerCase().includes('botão') || target.toLowerCase().includes('botao')) {
        // Substituir cores de botões
        const buttonRegex = /(className\s*=\s*["'][^"']*(?:bg-[\w-]+|text-[\w-]+)[^"']*["'])/g;
        newContent = newContent.replace(buttonRegex, (match) => {
          modified = true;
          return match.replace(/bg-[\w-]+/g, colorClass.split(' ')[0])
                     .replace(/text-[\w-]+/g, colorClass.split(' ')[1] || colorClass);
        });
      }

      if (modified) {
        modifications.push({
          path: file.path,
          content: newContent,
          operation: 'update',
          message: `Alterar cor do ${target} para ${color}`
        });
      }
    }

    return modifications;
  }

  /**
   * Altera textos específicos
   */
  private async changeText(target: string, oldText: string, newText: string): Promise<FileModification[]> {
    const files = await this.scanner.scanAllFiles();
    const modifications: FileModification[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.jsx') && !file.path.endsWith('.ts')) continue;

      const newContent = file.content.replace(new RegExp(oldText, 'gi'), newText);
      
      if (newContent !== file.content) {
        modifications.push({
          path: file.path,
          content: newContent,
          operation: 'update',
          message: `Alterar texto: "${oldText}" → "${newText}"`
        });
      }
    }

    return modifications;
  }

  /**
   * Adiciona novos componentes
   */
  private async addComponent(target: string, component: string): Promise<FileModification[]> {
    const modifications: FileModification[] = [];

    // Implementar lógica para adicionar componentes
    // Por enquanto, retorna vazio
    
    return modifications;
  }

  /**
   * Corrige bugs comuns
   */
  private async fixBug(description: string): Promise<FileModification[]> {
    const modifications: FileModification[] = [];

    // Implementar lógica para correção de bugs
    // Por enquanto, retorna vazio
    
    return modifications;
  }

  /**
   * Atualiza estilos
   */
  private async updateStyle(target: string, style: string): Promise<FileModification[]> {
    const modifications: FileModification[] = [];

    // Implementar lógica para atualização de estilos
    // Por enquanto, retorna vazio
    
    return modifications;
  }

  /**
   * Executa as modificações no repositório
   */
  async executeModifications(modifications: FileModification[]): Promise<string> {
    if (modifications.length === 0) {
      return "❌ Nenhuma modificação para aplicar.";
    }

    const results = await this.scanner.applyModifications(modifications);
    
    let message = `🚀 **Modificações Aplicadas!**\n\n`;
    
    if (results.success.length > 0) {
      message += `✅ **Sucesso (${results.success.length}):**\n`;
      results.success.forEach(success => {
        message += `   ${success}\n`;
      });
    }

    if (results.errors.length > 0) {
      message += `\n❌ **Erros (${results.errors.length}):**\n`;
      results.errors.forEach(error => {
        message += `   ${error}\n`;
      });
    }

    return message;
  }
}
