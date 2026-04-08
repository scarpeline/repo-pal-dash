CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES
  ('primary_gateway', 'stripe'),
  ('recharge_whatsapp_link', ''),
  ('recharge_button_enabled', 'false'),
  ('recharge_button_text', 'Recarregar via WhatsApp'),
  ('extension_whatsapp_link', ''),
  ('extension_button_enabled', 'false'),
  ('extension_button_text', 'Extensão WhatsApp')
ON CONFLICT (key) DO NOTHING;