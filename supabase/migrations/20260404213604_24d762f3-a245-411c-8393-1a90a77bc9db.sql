
-- Table to store admin-configurable AI model pricing
CREATE TABLE public.ai_model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL UNIQUE,
  model_label text NOT NULL,
  api_cost_input_per_million integer NOT NULL DEFAULT 0,
  api_cost_output_per_million integer NOT NULL DEFAULT 0,
  resale_price_input_per_million integer NOT NULL DEFAULT 0,
  resale_price_output_per_million integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

-- Everyone can read active pricing
CREATE POLICY "Anyone can view active pricing" ON public.ai_model_pricing
  FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR is_admin_email(auth.uid()));

-- Admins can manage pricing
CREATE POLICY "Admin can manage pricing" ON public.ai_model_pricing
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_email(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_admin_email(auth.uid()));

-- Insert default pricing data (costs in centavos per million tokens)
INSERT INTO public.ai_model_pricing (model_id, model_label, api_cost_input_per_million, api_cost_output_per_million, resale_price_input_per_million, resale_price_output_per_million) VALUES
  ('google/gemini-3-flash-preview', 'Gemini 3 Flash', 10, 40, 30, 120),
  ('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 15, 60, 45, 180),
  ('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 125, 500, 375, 1500),
  ('openai/gpt-5', 'GPT-5', 500, 1500, 1500, 4500),
  ('openai/gpt-5-mini', 'GPT-5 Mini', 80, 320, 240, 960),
  ('openai/gpt-5-nano', 'GPT-5 Nano', 10, 40, 30, 120);
