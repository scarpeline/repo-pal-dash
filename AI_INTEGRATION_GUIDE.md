# Guia de Integração de IAs - IAProgramador

## 🤖 IAs Suportadas

O sistema agora suporta múltiplas IAs que podem ser alternadas no chat:

1. **Gemini (Google)** - Padrão ✅
2. **DeepSeek** - Disponível ✅
3. **OpenAI** - Disponível ✅

---

## 📋 Configuração das API Keys

### 1. Gemini (Já configurado)
```
Nome: GEMINI_API_KEY
Valor: AIzaSy... (já configurado no Lovable)
Status: ✅ Ativo
```

### 2. DeepSeek
```
Nome: DEEPSEEK_API_KEY
Valor: sk-... (obter em https://platform.deepseek.com/api_keys)
Status: ⏳ Pendente configuração
```

### 3. OpenAI
```
Nome: OPENAI_API_KEY
Valor: sk-... (obter em https://platform.openai.com/api-keys)
Status: ⏳ Pendente configuração
```

---

## 🔧 Como Configurar

1. Acesse as Configurações do projeto
2. Vá em **Secrets** ou **Environment Variables**
3. Adicione as API keys que deseja usar
4. Salve e faça deploy

---

## 🎯 Como Alternar entre IAs

No chat, clique no seletor de IA (canto superior) para trocar entre:
- **Gemini** - Recomendado para uso geral
- **DeepSeek** - Ótimo para código e análise técnica
- **OpenAI** - GPT-4 para tarefas complexas

---

## 💰 Custo Estimado por IA

| IA | Custo (input) | Custo (output) | Ideal para |
|-----|---------------|----------------|------------|
| Gemini Flash | $0.35/M tokens | $1.05/M tokens | Uso geral, rápido |
| DeepSeek Chat | $0.07/M tokens | $1.10/M tokens | Código, análise |
| GPT-4o Mini | $0.15/M tokens | $0.60/M tokens | Tarefas complexas |

---

## 🆘 Troubleshooting

### Erro: "API key não configurada"
- Verifique se adicionou a key no Lovable Secrets
- Reinicie o preview após adicionar

### Erro: "Provider desativado"
- O provider precisa ser habilitado no código (`enabled: true`)
- Ou use o seletor de IA no chat para alternar

### Limites de Rate
- Gemini: 60 req/min (grátis)
- DeepSeek: 100 req/min (grátis)
- OpenAI: Depende do tier

---

## 📝 Próximos Passos

1. Obter API keys em:
   - DeepSeek: https://platform.deepseek.com
   - OpenAI: https://platform.openai.com

2. Adicionar no Lovable Secrets

3. Testar alternando entre IAs no chat

---

## 🚀 Arquivo de Configuração

A configuração das IAs está em:
```
src/integrations/ai/index.ts
```

Para adicionar uma nova IA, edite o array `AI_PROVIDERS`.
