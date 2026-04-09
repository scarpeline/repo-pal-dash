-- Add pricing for all new AI providers
-- Uses INSERT ... ON CONFLICT to avoid duplicates if models already exist

INSERT INTO public.ai_model_pricing (model_id, model_label, api_cost_input_per_million, api_cost_output_per_million, resale_price_input_per_million, resale_price_output_per_million)
VALUES
  -- DeepSeek
  ('deepseek/deepseek-chat', 'DeepSeek Chat', 7, 110, 21, 330),
  ('deepseek/deepseek-reasoner', 'DeepSeek Reasoner', 55, 219, 165, 657),
  -- Groq (ultra-fast inference)
  ('groq/llama-3.3-70b', 'Llama 3.3 70B (Groq)', 59, 79, 177, 237),
  ('groq/llama-3.1-8b', 'Llama 3.1 8B (Groq)', 5, 8, 15, 24),
  ('groq/mixtral-8x7b', 'Mixtral 8x7B (Groq)', 24, 24, 72, 72),
  -- Mistral
  ('mistral/codestral', 'Codestral (Mistral)', 30, 90, 90, 270),
  ('mistral/mistral-small', 'Mistral Small', 10, 30, 30, 90),
  -- OpenRouter (free tier)
  ('openrouter/deepseek/deepseek-chat:free', 'DeepSeek Free (OpenRouter)', 0, 0, 10, 30)
ON CONFLICT (model_id) DO UPDATE SET
  model_label = EXCLUDED.model_label,
  api_cost_input_per_million = EXCLUDED.api_cost_input_per_million,
  api_cost_output_per_million = EXCLUDED.api_cost_output_per_million,
  resale_price_input_per_million = EXCLUDED.resale_price_input_per_million,
  resale_price_output_per_million = EXCLUDED.resale_price_output_per_million;
