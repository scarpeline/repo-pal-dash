// Configuração de múltiplas IAs para o chat
export interface AIProvider {
  name: string;
  id: string;
  baseUrl: string;
  apiKeyEnv: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    name: "Gemini (Google)",
    id: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GEMINI_API_KEY",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"],
    defaultModel: "gemini-1.5-flash",
    enabled: true,
  },
  {
    name: "DeepSeek",
    id: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-coder"],
    defaultModel: "deepseek-chat",
    enabled: false, // Habilitar quando configurar API key
  },
  {
    name: "OpenAI",
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    defaultModel: "gpt-4o-mini",
    enabled: false, // Habilitar quando configurar API key
  },
];

// Função para obter a IA ativa
export function getActiveAI(): AIProvider {
  const enabled = AI_PROVIDERS.find(p => p.enabled);
  return enabled || AI_PROVIDERS[0]; // Default para Gemini
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

// Função genérica para enviar mensagem à IA
export async function sendMessageToAI(
  messages: ChatMessage[],
  provider: AIProvider = getActiveAI()
): Promise<string> {
  const apiKey = import.meta.env[provider.apiKeyEnv];
  
  if (!apiKey) {
    throw new Error(`API key não configurada: ${provider.apiKeyEnv}. Adicione nas Configurações (Secrets).`);
  }

  switch (provider.id) {
    case "gemini":
      return sendToGemini(messages, apiKey, provider);
    case "deepseek":
      return sendToDeepSeek(messages, apiKey, provider);
    case "openai":
      return sendToOpenAI(messages, apiKey, provider);
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

// DeepSeek implementation
async function sendToDeepSeek(
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
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sem resposta";
}

// OpenAI implementation
async function sendToOpenAI(
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
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sem resposta";
}

// Selector de IA para o chat
export function getAISelectorOptions(): { value: string; label: string }[] {
  return AI_PROVIDERS.map(p => ({
    value: p.id,
    label: `${p.name} ${p.enabled ? "(ativo)" : "(desativado)"}`,
  }));
}
