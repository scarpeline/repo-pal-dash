# 🤖 Guia de Configuração - Sistema Multi-IAs

## 🎯 Sistema de Roteamento Inteligente

O IAProgramador agora possui um **roteador inteligente** que analisa automaticamente cada mensagem e escolhe a melhor IA:

| Tipo de Tarefa | IA Selecionada | Por quê? |
|----------------|----------------|----------|
| 🚀 Geral/Rápido | **Gemini** | Grátis e ultrarrápido |
| 💻 Código Backend | **Mistral** | Melhor estruturação de código |
| 🔧 Código Geral | **DeepSeek** | Especializado em programação |
| ⚡ Resposta Imediata | **Groq** | Mais rápido do mercado (300+ tokens/s) |
| 📚 Contexto Longo | **Kimi** | Suporta até 128k tokens |
| 🧪 Experimental | **OpenRouter** | Acesso a modelos gratuitos |

---

## 📋 API Keys Necessárias

### ✅ Obrigatória (Já configurada)
```
GEMINI_API_KEY=AIzaSy... (já configurado)
```

### 🔧 Opcionais (Para mais poder)

#### DeepSeek (Programação)
```
DEEPSEEK_API_KEY=sk-...
Onde obter: https://platform.deepseek.com/api_keys
Custo: $0.07/M input | $1.10/M output
```

#### Groq (Velocidade)
```
GROQ_API_KEY=gsk_...
Onde obter: https://console.groq.com/keys
Custo: $0.59/M input | $0.79/M output
Modelo: llama-3.3-70b-versatile (300+ tokens/s!)
```

#### Mistral AI (Código Backend)
```
MISTRAL_API_KEY=...
Onde obter: https://console.mistral.ai/api-keys/
Custo: $0.20/M input | $0.60/M output
Modelo: codestral-latest (especializado em código!)
```

#### Kimi (Contexto Longo)
```
KIMI_API_KEY=...
Onde obter: https://platform.moonshot.cn/
Custo: $0.50/M input | $1.00/M output
```

#### OpenRouter (Acesso Universal)
```
OPENROUTER_API_KEY=sk-or-...
Onde obter: https://openrouter.ai/keys
Custo: Modelos gratuitos disponíveis!
```

---

## 🎮 Como Usar

### No Chat:
1. Clique no seletor de IA (canto superior)
2. Escolha **"🧠 Modo Inteligente"** para roteamento automático
3. Ou escolha uma IA específica para forçar o uso

### Exemplos de Roteamento:

| Você escreve... | IA usada | Motivo |
|-----------------|----------|--------|
| "Oi, tudo bem?" | Gemini | Simples e rápido |
| "Crie uma API REST" | Mistral | Especialista em backend |
| "Refatore este código" | DeepSeek | Especialista em código |
| "Preciso de resposta agora" | Groq | Mais rápido |
| "Analise este documento de 5000 palavras" | Kimi | Contexto longo |

---

## 🔧 Como Configurar

1. Acesse as **Configurações do projeto**
2. Vá em **Secrets** ou **Environment Variables**
3. Adicione as API keys desejadas
4. **Salve e faça deploy**
5. A Edge Function `ai-chat` usará automaticamente as IAs configuradas

---

## 💰 Custo Comparativo (por 1M tokens)

| IA | Input | Output | Melhor para |
|----|-------|--------|-------------|
| **Gemini** | Grátis | Grátis | Uso geral |
| **DeepSeek** | $0.07 | $1.10 | Código |
| **Groq** | $0.59 | $0.79 | Velocidade |
| **Mistral** | $0.20 | $0.60 | Backend |
| **Kimi** | $0.50 | $1.00 | Contexto longo |
| **OpenRouter** | $0 | $0 | Modelos free |
| **OpenAI** | $0.15 | $0.60 | GPT-4 |

---

## 🆘 Troubleshooting

### Erro: "API key não configurada"
- Verifique se adicionou a key nas Configurações
- Reinicie o preview após adicionar

### Erro: "Provider desativado"
- A IA só aparece se a API key estiver configurada
- Verifique se a key está correta

### Quero usar só uma IA específica
- Desative o "Modo Inteligente"
- Selecione a IA desejada manualmente

---

## 🚀 Deploy das Edge Functions

```bash
# Deploy manual via Supabase CLI
npx supabase functions deploy ai-chat
npx supabase functions deploy google-oauth
npx supabase functions deploy send-notification
```

Ou use o **Supabase Dashboard**:
1. Vá em Edge Functions
2. Deploy from GitHub
3. Selecione as funções

---

## 🎯 Resumo

✅ **Gemini**: Sempre funciona, grátis  
🔧 **DeepSeek**: Melhor para código ($0.07/M)  
⚡ **Groq**: Mais rápido (300 tokens/s)  
🏗️ **Mistral**: Melhor para backend  
📚 **Kimi**: Contexto longo (128k)  
🧪 **OpenRouter**: Modelos gratuitos  

**Recomendado**: Ative o **🧠 Modo Inteligente** para melhor experiência! 🎉
