-- Adiciona coluna para ID do produto no Asaas
ALTER TABLE packages ADD COLUMN IF NOT EXISTS asaas_product_id TEXT;

-- Comentário para documentar
COMMENT ON COLUMN packages.asaas_product_id IS 'ID do produto correspondente no Asaas';
