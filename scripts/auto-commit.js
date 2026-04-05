#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function executeCommand(command) {
  try {
    console.log(`🔧 Executando: ${command}`);
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return result.trim();
  } catch (error) {
    console.error(`❌ Erro ao executar: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

function getStagedFiles() {
  try {
    const result = executeCommand('git status --porcelain');
    return result.split('\n').filter(line => line.trim());
  } catch {
    return [];
  }
}

function generateCommitMessage(files) {
  const timestamp = new Date().toLocaleString('pt-BR');
  const hasPackageJson = files.some(f => f.includes('package.json'));
  const hasTSX = files.some(f => f.includes('.tsx'));
  const hasTS = files.some(f => f.includes('.ts'));
  const hasEnv = files.some(f => f.includes('.env'));
  
  if (hasPackageJson) return 'chore: atualiza dependências e scripts';
  if (hasEnv) return 'config: atualiza variáveis de ambiente';
  if (hasTSX || hasTS) return 'feat: melhoria nos componentes e funcionalidades';
  
  return `chore: atualização automática - ${timestamp}`;
}

async function main() {
  const shouldPush = process.argv.includes('--push');
  
  console.log('🚀 Auto Commit Tool - IAProgramador\n');
  
  // Verificar se há alterações
  const status = executeCommand('git status --porcelain');
  if (!status) {
    console.log('✅ Nenhuma alteração para commit!');
    rl.close();
    return;
  }
  
  console.log('📋 Arquivos modificados:');
  const files = getStagedFiles();
  files.forEach(file => {
    const status = file[0];
    const filename = file.substring(3);
    const icon = status === 'M' ? '📝' : status === 'A' ? '➕' : status === 'D' ? '🗑️' : '❓';
    console.log(`   ${icon} ${filename}`);
  });
  
  console.log('\n');
  
  // Adicionar todas as alterações
  console.log('📦 Adicionando arquivos...');
  executeCommand('git add .');
  
  // Gerar mensagem de commit
  const autoMessage = generateCommitMessage(files);
  console.log(`💬 Mensagem sugerida: "${autoMessage}"`);
  
  const customMessage = await question('Deseja usar mensagem personalizada? (deixe em branco para usar a sugerida): ');
  const commitMessage = customMessage.trim() || autoMessage;
  
  // Fazer commit
  console.log('\n💾 Fazendo commit...');
  executeCommand(`git commit -m "${commitMessage}"`);
  
  console.log('✅ Commit realizado com sucesso!');
  
  // Push se solicitado
  if (shouldPush) {
    console.log('\n📤 Enviando para o GitHub...');
    executeCommand('git push origin main');
    console.log('🎉 Push realizado com sucesso!');
  } else {
    const pushNow = await question('Deseja fazer push agora? (s/N): ');
    if (pushNow.toLowerCase() === 's') {
      console.log('📤 Enviando para o GitHub...');
      executeCommand('git push origin main');
      console.log('🎉 Push realizado com sucesso!');
    }
  }
  
  rl.close();
  console.log('\n🏁 Operação concluída!');
}

main().catch(console.error);
