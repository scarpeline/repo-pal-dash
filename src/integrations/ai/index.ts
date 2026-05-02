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
// Preços em USD por 1M tokens (abril 2026)
export const AI_PROVIDERS: AIProvider[] = [
  {
    name: "Google Gemini 3 Flash",
    id: "google-code-fast",
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    apiKeyEnv: "LOVABLE_API_KEY",
    models: ["google/gemini-3-flash-preview"],
    defaultModel: "google/gemini-3-flash-preview",
    enabled: true,
    characteristics: {
      codingStrength: 8, reasoningStrength: 8, speed: 10, costEfficiency: 10,
      contextWindow: 1000000, supportsStreaming: true,
      bestFor: ["chat", "code", "fast"],
    },
    pricing: { inputPer1M: 0.05, outputPer1M: 0.20 },
  },
  {
    name: "Google Gemini 2.5 Flash",
    id: "google-code-balanced",
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    apiKeyEnv: "LOVABLE_API_KEY",
    models: ["google/gemini-2.5-flash"],
    defaultModel: "google/gemini-2.5-flash",
    enabled: true,
    characteristics: {
      codingStrength: 9, reasoningStrength: 9, speed: 9, costEfficiency: 9,
      contextWindow: 1000000, supportsStreaming: true,
      bestFor: ["code", "app-edit", "analysis"],
    },
    pricing: { inputPer1M: 0.10, outputPer1M: 0.40 },
  },
  {
    name: "Google Gemini 2.5 Pro",
    id: "google-code-pro",
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    apiKeyEnv: "LOVABLE_API_KEY",
    models: ["google/gemini-2.5-pro"],
    defaultModel: "google/gemini-2.5-pro",
    enabled: true,
    characteristics: {
      codingStrength: 10, reasoningStrength: 10, speed: 7, costEfficiency: 7,
      contextWindow: 1000000, supportsStreaming: true,
      bestFor: ["complex-code", "architecture", "long-context"],
    },
    pricing: { inputPer1M: 1.25, outputPer1M: 10.00 },
  },
  {
    name: "Google Gemini Imagem",
    id: "google-image",
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    apiKeyEnv: "LOVABLE_API_KEY",
    models: ["google/gemini-3.1-flash-image-preview"],
    defaultModel: "google/gemini-3.1-flash-image-preview",
    enabled: true,
    characteristics: {
      codingStrength: 4, reasoningStrength: 7, speed: 8, costEfficiency: 8,
      contextWindow: 32000, supportsStreaming: false,
      bestFor: ["image", "logo", "creative"],
    },
    pricing: { inputPer1M: 0.30, outputPer1M: 2.00 },
  },
  {
    name: "Google Gemini Vídeo",
    id: "google-video",
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    apiKeyEnv: "LOVABLE_API_KEY",
    models: ["google/gemini-3.1-pro-preview"],
    defaultModel: "google/gemini-3.1-pro-preview",
    enabled: true,
    characteristics: {
      codingStrength: 8, reasoningStrength: 10, speed: 6, costEfficiency: 6,
      contextWindow: 1000000, supportsStreaming: true,
      bestFor: ["video", "remotion", "storyboard", "motion"],
    },
    pricing: { inputPer1M: 1.25, outputPer1M: 10.00 },
  },
  {
    name: "Gemini legado (compatibilidade)",
    id: "gemini",
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    apiKeyEnv: "LOVABLE_API_KEY",
    models: ["google/gemini-3-flash-preview"],
    defaultModel: "google/gemini-3-flash-preview",
    enabled: true,
    characteristics: {
      codingStrength: 8, reasoningStrength: 8, speed: 10, costEfficiency: 10,
      contextWindow: 1000000, supportsStreaming: true,
      bestFor: ["chat", "general", "fallback"],
    },
    pricing: { inputPer1M: 0.05, outputPer1M: 0.20 },
  },
  {
    name: "Claude Haiku",
    id: "claude-haiku",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-3-5-haiku-latest"],
    defaultModel: "claude-3-5-haiku-latest",
    enabled: true,
    characteristics: {
      codingStrength: 7, reasoningStrength: 7, speed: 9, costEfficiency: 8,
      contextWindow: 200000, supportsStreaming: true,
      bestFor: ["chat", "fast", "review"],
    },
    pricing: { inputPer1M: 0.80, outputPer1M: 4.00 },
  },
  {
    name: "Claude Sonnet 4.6",
    id: "claude-sonnet",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-5"],
    defaultModel: "claude-sonnet-4-5",
    enabled: true,
    characteristics: {
      codingStrength: 10, reasoningStrength: 10, speed: 7, costEfficiency: 6,
      contextWindow: 200000, supportsStreaming: true,
      bestFor: ["code", "app-edit", "architecture"],
    },
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
  },
  {
    name: "Claude Opus",
    id: "claude-opus",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-opus-4-1"],
    defaultModel: "claude-opus-4-1",
    enabled: true,
    characteristics: {
      codingStrength: 10, reasoningStrength: 10, speed: 5, costEfficiency: 4,
      contextWindow: 200000, supportsStreaming: true,
      bestFor: ["expert-code", "complex", "reasoning"],
    },
    pricing: { inputPer1M: 15.00, outputPer1M: 75.00 },
  },
  {
    name: "Kimi K2",
    id: "kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    apiKeyEnv: "KIMI_API_KEY",
    models: ["kimi-k2-0711-preview"],
    defaultModel: "kimi-k2-0711-preview",
    enabled: true,
    characteristics: {
      codingStrength: 8, reasoningStrength: 9, speed: 7, costEfficiency: 7,
      contextWindow: 128000, supportsStreaming: true,
      bestFor: ["long-context", "analysis", "code"],
    },
    pricing: { inputPer1M: 0.60, outputPer1M: 2.50 },
  },
  {
    name: "DeepSeek Coder",
    id: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat"],
    defaultModel: "deepseek-chat",
    enabled: true,
    characteristics: {
      codingStrength: 9, reasoningStrength: 8, speed: 8, costEfficiency: 9,
      contextWindow: 64000, supportsStreaming: true,
      bestFor: ["code", "debug", "refactor"],
    },
    pricing: { inputPer1M: 0.27, outputPer1M: 1.10 },
  },
  {
    name: "Groq Llama 3",
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    models: ["llama3-70b-8192"],
    defaultModel: "llama3-70b-8192",
    enabled: true,
    characteristics: {
      codingStrength: 7, reasoningStrength: 8, speed: 10, costEfficiency: 10,
      contextWindow: 8192, supportsStreaming: true,
      bestFor: ["chat", "fast", "simple"],
    },
    pricing: { inputPer1M: 0.15, outputPer1M: 0.20 },
  },
  {
    name: "OpenAI GPT-4o",
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "chave_API_openai",
    models: ["gpt-4o"],
    defaultModel: "gpt-4o",
    enabled: true,
    characteristics: {
      codingStrength: 10, reasoningStrength: 10, speed: 8, costEfficiency: 5,
      contextWindow: 128000, supportsStreaming: true,
      bestFor: ["reasoning", "complex", "chat"],
    },
    pricing: { inputPer1M: 5.00, outputPer1M: 15.00 },
  },
  {
    name: "OpenRouter (Universal)",
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    models: ["openai/gpt-4o"],
    defaultModel: "openai/gpt-4o",
    enabled: true,
    characteristics: {
      codingStrength: 10, reasoningStrength: 10, speed: 7, costEfficiency: 6,
      contextWindow: 128000, supportsStreaming: true,
      bestFor: ["universal", "any"],
    },
    pricing: { inputPer1M: 5.00, outputPer1M: 15.00 },
  },
  {
    name: "Resend Email IA",
    id: "resend",
    baseUrl: "https://api.resend.com",
    apiKeyEnv: "RESEND_API_KEY",
    models: ["resend-ia"],
    defaultModel: "resend-ia",
    enabled: true,
    characteristics: {
      codingStrength: 2, reasoningStrength: 5, speed: 9, costEfficiency: 9,
      contextWindow: 4000, supportsStreaming: false,
      bestFor: ["email", "notification"],
    },
    pricing: { inputPer1M: 0.10, outputPer1M: 0.10 },
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
  
  // REGRA 1: imagem/vídeo → rotas multimodais Google
  if (/\b(imagem|image|foto|logo|banner|thumbnail|arte)\b/i.test(content)) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-image") || AI_PROVIDERS[0];
    reasoning = "Criação visual: Gemini Imagem";
  } else if (/\b(vídeo|video|mp4|reel|motion|animaç|remotion)\b/i.test(content)) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-video") || AI_PROVIDERS[0];
    reasoning = "Criação de vídeo: Gemini Vídeo";
  }
  // REGRA 2: Tarefas simples → Gemini rápido e econômico
  else if (complexity === "simple") {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-code-fast") || AI_PROVIDERS[0];
    reasoning = "Tarefa simples: Gemini 3 Flash (rápido)";
  }
  // REGRA 3: Código backend complexo → Gemini Pro
  else if (isBackend && isCode) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-code-pro") || recommendedProvider;
    reasoning = "Código backend: Gemini 2.5 Pro";
  }
  // REGRA 4: Código geral → Gemini Flash equilibrado
  else if (isCode) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-code-balanced") || recommendedProvider;
    reasoning = "Programação: Gemini 2.5 Flash";
  }
  // REGRA 5: Precisa ser rápido → Gemini 3 Flash
  else if (complexity === "medium" && !requiresLongContext) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-code-fast") || recommendedProvider;
    reasoning = "Resposta rápida: Gemini 3 Flash";
  }
  // REGRA 6: Contexto longo → Gemini Pro
  else if (requiresLongContext) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-code-pro") || recommendedProvider;
    reasoning = "Contexto longo: Gemini 2.5 Pro";
  }
  // REGRA 7: Análise complexa → Gemini Pro
  else if (complexity === "complex" && isAnalysis) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-code-pro") || recommendedProvider;
    reasoning = "Análise complexa: Gemini 2.5 Pro";
  }
  
  // Se nenhuma IA paga estiver habilitada, usar Gemini
  if (!recommendedProvider.enabled) {
    recommendedProvider = AI_PROVIDERS.find(p => p.id === "google-code-fast") || AI_PROVIDERS[0];
    reasoning = "IA recomendada indisponível. Usando Gemini 3 Flash";
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
    case "google-code-fast":
    case "google-code-balanced":
    case "google-code-pro":
    case "google-image":
    case "google-video":
      return sendToGemini(messages, apiKey, provider);
    case "deepseek":
    case "groq":
    case "claude-haiku":
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
