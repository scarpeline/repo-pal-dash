ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_gateway_unique
ON public.transactions (payment_gateway, external_id)
WHERE external_id IS NOT NULL;