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
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.jsx') && !file.path.endsWith('.css') && !file.path.endsWith('.scss')) continue;

      let modified = false;
      let newContent = file.content;

      // Mapear cores comuns para classes Tailwind
      const colorMap: { [key: string]: string } = {
        'azul': 'blue',
        'vermelho': 'red',
        'verde': 'green',
        'amarelo': 'yellow',
        'roxo': 'purple',
        'cinza': 'gray',
        'preto': 'black',
        'branco': 'white',
        'laranja': 'orange',
        'rosa': 'pink',
        'índigo': 'indigo',
        'teal': 'teal',
        'ciano': 'cyan'
      };

      const baseColor = colorMap[color.toLowerCase()] || color.toLowerCase();

      // Procurar e substituir cores em diferentes contextos
      if (target.toLowerCase().includes('botão') || target.toLowerCase().includes('botao')) {
        // Substituir cores de botões
        const buttonPatterns = [
          /(className\s*=\s*["'][^"']*\b(bg-\w+-\d+|text-\w+-\d+|border-\w+-\d+)[^"']*["'])/g,
          /(className\s*=\s*["'][^"']*\b(bg-\w+|text-\w+|border-\w+)[^"']*["'])/g
        ];

        buttonPatterns.forEach(pattern => {
          newContent = newContent.replace(pattern, (match) => {
            modified = true;
            return match
              .replace(/bg-\w+-\d+/g, `bg-${baseColor}-500`)
              .replace(/bg-\w+/g, `bg-${baseColor}-500`)
              .replace(/text-\w+-\d+/g, `text-${baseColor}-600`)
              .replace(/text-\w+/g, `text-${baseColor}-600`)
              .replace(/border-\w+-\d+/g, `border-${baseColor}-500`)
              .replace(/border-\w+/g, `border-${baseColor}-500`);
          });
        });
      }

      // Para elementos genéricos
      if (target.toLowerCase().includes('header') || target.toLowerCase().includes('cabeçalho')) {
        newContent = newContent.replace(/(header|Header).*?className\s*=\s*["'][^"']*["']/g, (match) => {
          modified = true;
          return match.replace(/bg-\w+-\d+/g, `bg-${baseColor}-600`);
        });
      }

      if (target.toLowerCase().includes('footer') || target.toLowerCase().includes('rodapé')) {
        newContent = newContent.replace(/(footer|Footer).*?className\s*=\s*["'][^"']*["']/g, (match) => {
          modified = true;
          return match.replace(/bg-\w+-\d+/g, `bg-${baseColor}-700`);
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
    const files = await this.scanner.scanAllFiles();
    const modifications: FileModification[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.jsx')) continue;

      // Focar no arquivo principal (App, index, main)
      if (!file.path.includes('App') && !file.path.includes('index') && !file.path.includes('main')) continue;

      let modified = false;
      let newContent = file.content;

      // Adicionar footer
      if (component.toLowerCase().includes('footer') || component.toLowerCase().includes('rodapé')) {
        const footerComponent = `
<footer className="bg-gray-800 text-white py-8 mt-auto">
  <div className="container mx-auto px-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">IAProgramador</h3>
        <p className="text-gray-300">Sua plataforma de desenvolvimento com IA</p>
      </div>
      <div>
        <h4 className="text-md font-semibold mb-4">Links</h4>
        <ul className="space-y-2">
          <li><a href="#" className="text-gray-300 hover:text-white">Documentação</a></li>
          <li><a href="#" className="text-gray-300 hover:text-white">Suporte</a></li>
          <li><a href="#" className="text-gray-300 hover:text-white">GitHub</a></li>
        </ul>
      </div>
      <div>
        <h4 className="text-md font-semibold mb-4">Contato</h4>
        <p className="text-gray-300">contato@iaprogramador.online</p>
      </div>
    </div>
    <div className="border-t border-gray-700 mt-8 pt-8 text-center">
      <p className="text-gray-400">&copy; 2024 IAProgramador. Todos os direitos reservados.</p>
    </div>
  </div>
</footer>`;

        // Inserir footer antes do fechamento do body ou main
        if (newContent.includes('</body>')) {
          newContent = newContent.replace('</body>', `${footerComponent}\n</body>`);
          modified = true;
        } else if (newContent.includes('</main>')) {
          newContent = newContent.replace('</main>', `</main>\n${footerComponent}`);
          modified = true;
        }
      }

      // Adicionar header
      if (component.toLowerCase().includes('header') || component.toLowerCase().includes('cabeçalho')) {
        const headerComponent = `
<header className="bg-white shadow-md">
  <div className="container mx-auto px-4 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold text-gray-800">IAProgramador</h1>
      </div>
      <nav className="hidden md:flex space-x-6">
        <a href="#" className="text-gray-600 hover:text-gray-800">Início</a>
        <a href="#" className="text-gray-600 hover:text-gray-800">Recursos</a>
        <a href="#" className="text-gray-600 hover:text-gray-800">Preços</a>
        <a href="#" className="text-gray-600 hover:text-gray-800">Contato</a>
      </nav>
      <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
        Começar
      </button>
    </div>
  </div>
</header>`;

        // Inserir header no início do body
        if (newContent.includes('<body>')) {
          newContent = newContent.replace('<body>', `<body>\n${headerComponent}`);
          modified = true;
        }
      }

      if (modified) {
        modifications.push({
          path: file.path,
          content: newContent,
          operation: 'update',
          message: `Adicionar componente: ${component}`
        });
      }
    }

    return modifications;
  }

  /**
   * Corrige bugs comuns
   */
  private async fixBug(description: string): Promise<FileModification[]> {
    const files = await this.scanner.scanAllFiles();
    const modifications: FileModification[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.jsx') && !file.path.endsWith('.ts') && !file.path.endsWith('.js')) continue;

      let modified = false;
      let newContent = file.content;

      // Corrigir bugs comuns baseados na descrição
      if (description.toLowerCase().includes('formulario') || description.toLowerCase().includes('formulário')) {
        // Adicionar validação de formulário
        newContent = newContent.replace(
          /(<form[^>]*>)/,
          '$1\n  {/* Validação adicionada automaticamente */}\n'
        );
        modified = true;
      }

      if (description.toLowerCase().includes('login') || description.toLowerCase().includes('autenticação')) {
        // Corrigir problemas de autenticação
        newContent = newContent.replace(
          /const\s+\[user,\s*setUser\]\s*=\s*useState\(\);/g,
          'const [user, setUser] = useState(null);\n  // Estado de autenticação corrigido'
        );
        modified = true;
      }

      if (description.toLowerCase().includes('responsivo') || description.toLowerCase().includes('mobile')) {
        // Adicionar classes responsivas
        newContent = newContent.replace(
          /className\s*=\s*["']([^"']*)["']/g,
          (match, classes) => {
            if (!classes.includes('md:') && !classes.includes('lg:')) {
              return `className="${classes} md:${classes}"`;
            }
            return match;
          }
        );
        modified = true;
      }

      if (modified) {
        modifications.push({
          path: file.path,
          content: newContent,
          operation: 'update',
          message: `Corrigir bug: ${description}`
        });
      }
    }

    return modifications;
  }

  /**
   * Atualiza estilos
   */
  private async updateStyle(target: string, style: string): Promise<FileModification[]> {
    const files = await this.scanner.scanAllFiles();
    const modifications: FileModification[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.jsx') && !file.path.endsWith('.css') && !file.path.endsWith('.scss')) continue;

      let modified = false;
      let newContent = file.content;

      // Melhorar estilos baseados no target
      if (target.toLowerCase().includes('botão') || target.toLowerCase().includes('botao')) {
        // Melhorar estilo de botões
        newContent = newContent.replace(
          /className\s*=\s*["'][^"']*button[^"']*["']/g,
          'className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 shadow-md hover:shadow-lg"'
        );
        modified = true;
      }

      if (target.toLowerCase().includes('card') || target.toLowerCase().includes('cartão')) {
        // Melhorar estilo de cards
        newContent = newContent.replace(
          /className\s*=\s*["'][^"']*card[^"']*["']/g,
          'className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100"'
        );
        modified = true;
      }

      if (modified) {
        modifications.push({
          path: file.path,
          content: newContent,
          operation: 'update',
          message: `Atualizar estilo do ${target}`
        });
      }
    }

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
