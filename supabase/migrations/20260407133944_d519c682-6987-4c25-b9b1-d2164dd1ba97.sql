ALTER TABLE public.packages 
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

UPDATE public.packages SET stripe_price_id = 'price_1TJZEYER6bkHB3lVfO3RHpWi', stripe_product_id = 'prod_UI9XYl8qmJCYme' WHERE price_brl = 1000;
UPDATE public.packages SET stripe_price_id = 'price_1TJZJRER6bkHB3lVznIZO6Ob', stripe_product_id = 'prod_UI9cRFnA9CnbK5' WHERE price_brl = 1500;
UPDATE public.packages SET stripe_price_id = 'price_1TJZJRER6bkHB3lVja6BrbWh', stripe_product_id = 'prod_UI9cRFnA9CnbK5' WHERE price_brl = 2000;
UPDATE public.packages SET stripe_price_id = 'price_1TJZNLER6bkHB3lVlyoSy6wY', stripe_product_id = 'prod_UI9gnJ8rU9g3De' WHERE price_brl = 2500;
UPDATE public.packages SET stripe_price_id = 'price_1TJZNLER6bkHB3lVGtPBp7UX', stripe_product_id = 'prod_UI9gnJ8rU9g3De' WHERE price_brl = 3000;
UPDATE public.packages SET stripe_price_id = 'price_1TJZNLER6bkHB3lVcCeN6mJA', stripe_product_id = 'prod_UI9gnJ8rU9g3De' WHERE price_brl = 5000;
UPDATE public.packages SET stripe_price_id = 'price_1TJZOuER6bkHB3lVC0O5gpfa', stripe_product_id = 'prod_UI9gnJ8rU9g3De' WHERE price_brl = 7000;
UPDATE public.packages SET stripe_price_id = 'price_1TJZOuER6bkHB3lVzLHVV10b', stripe_product_id = 'prod_UI9gnJ8rU9g3De' WHERE price_brl = 10000;