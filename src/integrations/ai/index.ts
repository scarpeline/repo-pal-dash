// 🧠 Sistema Inteligente de Roteamento de IAs
// Analisa a complexidade da tarefa e escolhe a melhor IA automaticamente

export interface AIProvider {
  name: string;
  id: string;
  baseUrl: string;
  apiKeyEnv: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
  // Características para roteamento inteligente
  characteristics: {
    codingStrength: number; // 1-10 (programação)
    reasoningStrength: number; // 1-10 (raciocínio lógico)
    speed: number; // 1-10 (velocidade)
    costEfficiency: number; // 1-10 (custo-benefício)
    contextWindow: number; // em tokens
    supportsStreaming: boolean;
    bestFor: string[]; // ['code', 'chat', 'analysis', 'creative', 'math']
  };
  pricing: {
    inputPer1M: number; // USD por 1M tokens
    outputPer1M: number; // USD por 1M tokens
  };
}

// 🎯 Configuração de todos os provedores de IA
export const AI_PROVIDERS: AIProvider[] = [
  {
    name: "Gemini (Google)",
    id: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GEMINI_API_KEY",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"],
    defaultModel: "gemini-1.5-flash",
    enabled: true,
    characteristics: {
      codingStrength: 7,
      reasoningStrength: 7,
      speed: 9,
      costEfficiency: 10, // Grátis!
      contextWindow: 1000000,
      supportsStreaming: true,
      bestFor: ["chat", "general", "fast"],
    },
    pricing: { inputPer1M: 0, outputPer1M: 0 }, // Grátis
  },
  {
    name: "DeepSeek",
    id: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    defaultModel: "deepseek-coder",
    enabled: false,
    characteristics: {
      codingStrength: 9,
      reasoningStrength: 8,
      speed: 7,
      costEfficiency: 9, // Muito barato
      contextWindow: 64000,
      supportsStreaming: true,
      bestFor: ["code", "analysis", "technical"],
    },
    pricing: { inputPer1M: 0.07, outputPer1M: 1.10 },
  },
  {
    name: "Groq (Ultra Rápido)",
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    models: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.1-8b-instant",
      "llama3-groq-8b-8192-tool-use-preview",
    ],
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    enabled: false,
    characteristics: {
      codingStrength: 9,
      reasoningStrength: 8,
      speed: 10,
      costEfficiency: 9,
      contextWindow: 128000,
      supportsStreaming: true,
      bestFor: ["fast", "chat", "general", "code"],
    },
    pricing: { inputPer1M: 0.11, outputPer1M: 0.34 },
  },
  {
    name: "Claude Sonnet 4.5",
    id: "claude-sonnet",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-5"],
    defaultModel: "claude-sonnet-4-5",
    enabled: false,
    characteristics: {
      codingStrength: 10,
      reasoningStrength: 10,
      speed: 8,
      costEfficiency: 7,
      contextWindow: 200000,
      supportsStreaming: true,
      bestFor: ["code", "analysis", "reasoning", "creative"],
    },
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
  },
  {
    name: "Claude Haiku 4.5",
    id: "claude-haiku",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-haiku-4-5"],
    defaultModel: "claude-haiku-4-5",
    enabled: false,
    characteristics: {
      codingStrength: 8,
      reasoningStrength: 8,
      speed: 10,
      costEfficiency: 9,
      contextWindow: 200000,
      supportsStreaming: true,
      bestFor: ["fast", "chat", "simple", "code"],
    },
    pricing: { inputPer1M: 1.00, outputPer1M: 5.00 },
  },
  {
    name: "Claude Opus 4.6",
    id: "claude-opus",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-opus-4-6"],
    defaultModel: "claude-opus-4-6",
    enabled: false,
    characteristics: {
      codingStrength: 10,
      reasoningStrength: 10,
      speed: 5,
      costEfficiency: 4,
      contextWindow: 200000,
      supportsStreaming: true,
      bestFor: ["complex", "reasoning", "research", "expert"],
    },
    pricing: { inputPer1M: 5.00, outputPer1M: 25.00 },
  },
  {
    name: "Kimi (Moonshot)",
    id: "kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    apiKeyEnv: "KIMI_API_KEY",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    defaultModel: "moonshot-v1-32k",
    enabled: false,
    characteristics: {
      codingStrength: 8,
      reasoningStrength: 9,
      speed: 7,
      costEfficiency: 8,
      contextWindow: 128000,
      supportsStreaming: true,
      bestFor: ["long-context", "analysis", "code"],
    },
    pricing: { inputPer1M: 0.50, outputPer1M: 1.00 },
  },
  {
    name: "OpenRouter (Acesso Universal)",
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    models: [
      "deepseek/deepseek-chat:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "microsoft/wizardlm-2-8x22b:free",
      "nousresearch/hermes-3-llama-3.1-405b:free"
    ],
    defaultModel: "deepseek/deepseek-chat:free",
    enabled: false,
    characteristics: {
      codingStrength: 8,
      reasoningStrength: 8,
      speed: 7,
      costEfficiency: 10, // Tem modelos gratuitos!
      contextWindow: 64000,
      supportsStreaming: true,
      bestFor: ["universal", "free", "experimental"],
    },
    pricing: { inputPer1M: 0, outputPer1M: 0 }, // Free models available
  },
  {
    name: "GPT OSS 20B (Groq)",
    id: "gpt-oss",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    models: ["openai/gpt-4o-mini"],
    defaultModel: "openai/gpt-4o-mini",
    enabled: false,
    characteristics: {
      codingStrength: 8,
      reasoningStrength: 8,
      speed: 10,
      costEfficiency: 9,
      contextWindow: 128000,
      supportsStreaming: true,
      bestFor: ["chat", "general", "fast", "code"],
    },
    pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
  },
  {
    name: "OpenAI (GPT-4o mini)",
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    models: ["gpt-4o-mini"],
    defaultModel: "gpt-4o-mini",
    enabled: false,
    characteristics: {
      codingStrength: 8,
      reasoningStrength: 9,
      speed: 8,
      costEfficiency: 7,
      contextWindow: 128000,
      supportsStreaming: true,
      bestFor: ["general", "creative", "analysis"],
    },
    pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
  },
];

// Função para obter a IA ativa
export function getActiveAI(): AIProvider {
  const enabled = AI_PROVIDERS.find(p => p.enabled);
  return enabled || AI_PROVIDERS[0]; // Default para Gemini
}

// 🎯 Níveis de complexidade
export type ComplexityLevel = "simple" | "medium" | "complex" | "expert";

export interface TaskAnalysis {
  complexity: ComplexityLevel;
  isCode: boolean;
  isBackend: boolean;
  isAnalysis: boolean;
  isCreative: boolean;
  requiresLongContext: boolean;
  estimatedTokens: number;
  recommendedProvider: AIProvider;
  reasoning: string;
}

// 🧠 Função de análise de complexidade
export function analyzeTask(messages: ChatMessage[]): TaskAnalysis {
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage?.content?.toLowerCase() || "";
  
  // Detectar características da tarefa
  const isCode = /\b(código|code|programar|function|class|import|export|const|let|var|def|python|javascript|typescript|react|vue|angular|html|css|sql|api|backend|frontend)\b/.test(content);
  const isBackend = /\b(backend|servidor|server|database|banco de dados|api|endpoint|rest|graphql|prisma|supabase|postgresql|mysql|mongodb)\b/.test(content);
  const isAnalysis = /\b(analisar|análise|explicar|explain|compare|diferença|por que|why|how|como funciona)\b/.test(content);
  const isCreative = /\b(criar|create|design|imagine|story|história|poema|creative)\b/.test(content);
  const isComplex = /\b(complexo|complex|arquitetura|architecture|refatorar|refactor|optimize|otimizar|performance|segurança|security|integrar|integrate)\b/.test(content);
  const isSimple = /\b(oi|olá|hello|oi tudo bem|como vai|simples|fácil|easy|quick|rápido)\b/.test(content) && content.length < 200;
  const requiresLongContext = content.length > 3000 || /\b(longo|long|grande|large|documento|document|texto completo|full text)\b/.test(content);
  
  // Calcular tamanho estimado
  const estimatedTokens = Math.ceil(content.length / 4) + 500;
  
  // Determinar nível de complexidade
  let complexity: ComplexityLevel = "medium";
  if (isSimple) complexity = "simple";
  else if (isComplex || isBackend || requiresLongContext) complexity = "complex";
  else if (isCode && content.length > 1000) complexity = "complex";
  
  // 🎯 ROTEAMENTO INTELIGENTE - Escolher melhor IA
  let recommendedProvider = AI_PROVIDERS[0]; // Default: Gemini
  let reasoning = "";
  
  // REGRA 1: Tarefas simples → Gemini (grátis e rápido)
  if (complexity === "simple") {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "gemini") || AI_PROVIDERS[0];
    reasoning = "Tarefa simples: Gemini (gratuito e rápido)";
  }
  // REGRA 2: Código backend complexo → Claude Sonnet
  else if (isBackend && isCode) {
    const claude = AI_PROVIDERS.find(p => p.id === "claude-sonnet");
    if (claude?.enabled) {
      recommendedProvider = claude;
      reasoning = "Código backend: Claude Sonnet 4.5 (melhor raciocínio)";
    } else {
      recommendedProvider = AI_PROVIDERS.find(p => p.id === "deepseek") || recommendedProvider;
      reasoning = "Código backend: DeepSeek Coder";
    }
  }
  // REGRA 3: Código geral → DeepSeek
  else if (isCode) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "deepseek") || recommendedProvider;
    reasoning = "Programação: DeepSeek Coder (especializado em código)";
  }
  // REGRA 4: Precisa ser rápido → Groq
  else if (complexity === "medium" && !requiresLongContext) {
    const groq = AI_PROVIDERS.find(p => p.id === "groq");
    if (groq?.enabled) {
      recommendedProvider = groq;
      reasoning = "Resposta rápida: Groq (mais rápido do mercado)";
    }
  }
  // REGRA 5: Contexto longo → Kimi ou Gemini Pro
  else if (requiresLongContext) {
    const kimi = AI_PROVIDERS.find(p => p.id === "kimi");
    if (kimi?.enabled) {
      recommendedProvider = kimi;
      reasoning = "Contexto longo: Kimi (128k tokens)";
    } else {
      reasoning = "Contexto longo: Gemini Pro (1M tokens)";
    }
  }
  // REGRA 6: Análise complexa → Claude Opus
  else if (complexity === "complex" && isAnalysis) {
    const opus = AI_PROVIDERS.find(p => p.id === "claude-opus");
    if (opus?.enabled) {
      recommendedProvider = opus;
      reasoning = "Análise complexa: Claude Opus 4.6 (máximo raciocínio)";
    } else {
      const groq = AI_PROVIDERS.find(p => p.id === "groq");
      if (groq?.enabled) {
        recommendedProvider = groq;
        reasoning = "Análise complexa: Groq Llama 4 Scout";
      }
    }
  }
  
  // Se nenhuma IA paga estiver habilitada, usar Gemini
  if (!recommendedProvider.enabled) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "gemini") || AI_PROVIDERS[0];
    reasoning = "IA recomendada desabilitada. Usando Gemini (sempre disponível)";
  }
  
  return {
    complexity,
    isCode,
    isBackend,
    isAnalysis,
    isCreative,
    requiresLongContext,
    estimatedTokens,
    recommendedProvider,
    reasoning,
  };
}

// Função para alternar entre IAs
export function setActiveAI(providerId: string): void {
  AI_PROVIDERS.forEach(p => {
    p.enabled = p.id === providerId;
  });
}

// Interface para mensagens do chat
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  model?: string;
}

// 🎯 Função principal com roteamento automático
export async function sendMessageWithRouting(
  messages: ChatMessage[],
  forceProvider?: string
): Promise<{ content: string; provider: AIProvider; analysis: TaskAnalysis }> {
  
  // Analisar tarefa
  const analysis = analyzeTask(messages);
  
  // Usar provider forçado ou o recomendado pela análise
  let provider = analysis.recommendedProvider;
  if (forceProvider) {
    const forced = AI_PROVIDERS.find(p => p.id === forceProvider && p.enabled);
    if (forced) provider = forced;
  }
  
  // Verificar se tem API key
  const apiKey = import.meta.env[provider.apiKeyEnv];
  if (!apiKey && provider.id !== "gemini") {
    // Fallback para Gemini se API key não configurada
    provider = AI_PROVIDERS.find(p => p.id === "gemini") || AI_PROVIDERS[0];
  }
  
  // Enviar mensagem
  const content = await sendMessageToAI(messages, provider);
  
  return { content, provider, analysis };
}

// 💬 Função genérica para enviar mensagem
export async function sendMessageToAI(
  messages: ChatMessage[],
  provider: AIProvider = getActiveAI()
): Promise<string> {
  const apiKey = import.meta.env[provider.apiKeyEnv];
  
  if (!apiKey) {
    throw new Error(`API key não configurada: ${provider.apiKeyEnv}. Adicione nas Configurações.`);
  }

  switch (provider.id) {
    case "gemini":
      return sendToGemini(messages, apiKey, provider);
    case "deepseek":
    case "groq":
    case "claude-sonnet":
    case "claude-opus":
    case "kimi":
    case "openrouter":
    case "openai":
      return sendToOpenAICompatible(messages, apiKey, provider);
    default:
      throw new Error(`Provider não suportado: ${provider.id}`);
  }
}

// Gemini implementation
async function sendToGemini(
  messages: ChatMessage[],
  apiKey: string,
  provider: AIProvider
): Promise<string> {
  const url = `${provider.baseUrl}/models/${provider.defaultModel}:generateContent?key=${apiKey}`;
  
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : m.role,
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta";
}

// 🌐 OpenAI-compatible API (DeepSeek, Groq, Mistral, Kimi, OpenRouter, OpenAI)
async function sendToOpenAICompatible(
  messages: ChatMessage[],
  apiKey: string,
  provider: AIProvider
): Promise<string> {
  const url = `${provider.baseUrl}/chat/completions`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.defaultModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider.name} API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sem resposta";
}

// Selector de IA para o chat
export function getAISelectorOptions(): { value: string; label: string; description: string }[] {
  return AI_PROVIDERS.map(p => ({
    value: p.id,
    label: `${p.name} ${p.enabled ? "✓" : "○"}`,
    description: `💰 $${p.pricing.inputPer1M}/$${p.pricing.outputPer1M} | ⚡ ${p.characteristics.speed}/10 | 🎯 ${p.characteristics.bestFor.join(", ")}`,
  }));
}

// 🎛️ Funções utilitárias
export function getEnabledProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.enabled);
}

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}

export function enableProvider(id: string, enabled: boolean): void {
  const provider = AI_PROVIDERS.find(p => p.id === id);
  if (provider) provider.enabled = enabled;
}

// 🎨 Função para exibir análise em formato legível
export function formatAnalysis(analysis: TaskAnalysis): string {
  return `
🧠 Análise da Tarefa:
   Complexidade: ${analysis.complexity}
   É código: ${analysis.isCode ? "Sim" : "Não"}
   É backend: ${analysis.isBackend ? "Sim" : "Não"}
   Contexto longo: ${analysis.requiresLongContext ? "Sim" : "Não"}
   
🎯 IA Selecionada: ${analysis.recommendedProvider.name}
   💡 Motivo: ${analysis.reasoning}
  `;
}
