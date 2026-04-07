-- Garantir colunas de multi-gateway nos perfis
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Garantir colunas extras nos pacotes
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_product_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_plan_id TEXT;

-- Garantir tabela app_settings com RLS
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Políticas app_settings (idempotentes)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Anyone can view settings'
  ) THEN
    CREATE POLICY "Anyone can view settings" ON public.app_settings
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Only admin can manage settings'
  ) THEN
    CREATE POLICY "Only admin can manage settings" ON public.app_settings
      FOR ALL TO authenticated
      USING (public.is_admin_email(auth.uid()))
      WITH CHECK (public.is_admin_email(auth.uid()));
  END IF;
END $$;

-- Seed do gateway padrão
INSERT INTO app_settings (key, value)
VALUES ('primary_gateway', '"asaas"')
ON CONFLICT (key) DO NOTHING;

-- Garantir coluna payment_gateway em transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'asaas';

-- Índice para busca por external_id (deduplicação de webhooks)
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id)
  WHERE external_id IS NOT NULL;
