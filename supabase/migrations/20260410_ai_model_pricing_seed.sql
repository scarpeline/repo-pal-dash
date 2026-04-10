-- Migration: Popular tabela ai_model_pricing com custos reais e preços de revenda
-- Câmbio base: USD 1 = R$ 5,40 (abril 2026)
-- Markup de revenda: ~300% sobre custo em R$
-- Valores em centavos de R$ por 1 milhão de tokens

-- Limpar registros antigos para evitar duplicatas
DELETE FROM ai_model_pricing WHERE model_id IN (
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-3-flash-preview',
  'groq/llama-4-scout',
  'groq/llama-3.1-8b',
  'groq/gpt-oss',
  'deepseek/deepseek-coder',
  'deepseek/deepseek-chat',
  'moonshot/moonshot-v1-32k',
  'anthropic/claude-haiku-4-5',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-opus-4-6',
  'openai/gpt-4o-mini',
  'openrouter/deepseek-free'
);

INSERT INTO ai_model_pricing (
  model_id,
  model_label,
  api_cost_input_per_million,
  api_cost_output_per_million,
  resale_price_input_per_million,
  resale_price_output_per_million,
  is_active
) VALUES
  -- Gemini Flash (grátis — cobramos taxa de serviço)
  ('google/gemini-2.5-flash',      'Gemini 2.5 Flash',      0,    0,    50,    200,   true),
  ('google/gemini-3-flash-preview', 'Gemini 3 Flash Preview', 0,    0,    50,    200,   true),
  ('google/gemini-2.5-pro',        'Gemini 2.5 Pro',         0,    0,    100,   400,   true),

  -- Groq — Llama 4 Scout ($0.11/$0.34 USD/1M → custo R$0,59/R$1,84 → revenda ~300%)
  ('groq/llama-4-scout',           'Llama 4 Scout (Groq)',   59,   184,  200,   600,   true),

  -- Groq — Llama 3.1 8B ($0.05/$0.08 USD/1M → custo R$0,27/R$0,43)
  ('groq/llama-3.1-8b',            'Llama 3.1 8B (Groq)',    27,   43,   100,   200,   true),

  -- Groq — GPT OSS ($0.075/$0.30 USD/1M → custo R$0,41/R$1,62)
  ('groq/gpt-oss',                 'GPT OSS 20B (Groq)',     41,   162,  150,   500,   true),

  -- DeepSeek Coder ($0.28/$1.10 USD/1M → custo R$1,51/R$5,94)
  ('deepseek/deepseek-coder',      'DeepSeek Coder',         151,  594,  500,   2000,  true),
  ('deepseek/deepseek-chat',       'DeepSeek Chat',          151,  594,  500,   2000,  true),

  -- Kimi 32k ($0.50/$1.50 USD/1M → custo R$2,70/R$8,10)
  ('moonshot/moonshot-v1-32k',     'Kimi 32k (Moonshot)',    270,  810,  900,   3000,  true),

  -- Claude Haiku 4.5 ($1.00/$5.00 USD/1M → custo R$5,40/R$27,00)
  ('anthropic/claude-haiku-4-5',   'Claude Haiku 4.5',       540,  2700, 1800,  9000,  true),

  -- Claude Sonnet 4.5 ($3.00/$15.00 USD/1M → custo R$16,20/R$81,00)
  ('anthropic/claude-sonnet-4-5',  'Claude Sonnet 4.5',      1620, 8100, 5500,  27000, true),

  -- Claude Opus 4.6 ($5.00/$25.00 USD/1M → custo R$27,00/R$135,00)
  ('anthropic/claude-opus-4-6',    'Claude Opus 4.6',        2700, 13500,9000,  45000, true),

  -- GPT-4o mini ($0.15/$0.60 USD/1M → custo R$0,81/R$3,24)
  ('openai/gpt-4o-mini',           'GPT-4o mini (OpenAI)',   81,   324,  300,   1100,  true),

  -- OpenRouter Free (grátis — taxa de serviço)
  ('openrouter/deepseek-free',     'OpenRouter Free',        0,    0,    50,    200,   true);

-- Comentário explicativo:
-- api_cost_*: custo real que você paga à API (centavos de R$ por 1M tokens)
-- resale_price_*: o que o usuário paga (centavos de R$ por 1M tokens)
-- Margem média: ~300% (você recebe 3x o que paga)
-- Exemplo Claude Sonnet: usuário paga R$0,055/1M input + R$0,27/1M output
--   vs custo real R$0,016/1M input + R$0,081/1M output → lucro ~240%
