-- Add checkout fields to packages
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS checkout_url TEXT,
ADD COLUMN IF NOT EXISTS asaas_payment_link_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Record customer IDs for seamless webhook matching
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Centralized App Settings for Gateway management
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initialize default gateway as Asaas
INSERT INTO app_settings (key, value) 
VALUES ('primary_gateway', '"asaas"')
ON CONFLICT (key) DO NOTHING;
