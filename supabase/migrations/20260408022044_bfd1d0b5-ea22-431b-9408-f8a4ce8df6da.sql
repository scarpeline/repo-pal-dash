ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS asaas_payment_link_id text;