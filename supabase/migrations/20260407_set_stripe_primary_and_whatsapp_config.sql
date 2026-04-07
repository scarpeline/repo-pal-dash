-- Migration: Alterar gateway primário para Stripe e adicionar configurações de recarga
-- Created: 2026-04-07

-- 1. Alterar gateway primário para Stripe
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'primary_gateway', 
  'stripe', 
  'Gateway de pagamento primário (stripe ou asaas)',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  value = 'stripe',
  updated_at = NOW();

-- 2. Adicionar configuração de link de recarga WhatsApp
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'recharge_whatsapp_link', 
  'https://wa.me/5514991611225?text=Ol%C3%A1%2C%20quero%20fazer%20uma%20recarga%20no%20IA%20PROGRAMADOR', 
  'Link WhatsApp para recarga manual de créditos',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  updated_at = NOW();

-- 3. Adicionar configuração para ativar/desativar botão de recarga
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'recharge_button_enabled', 
  'true', 
  'Ativar/desativar botão de recarga via WhatsApp (true/false)',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  updated_at = NOW();

-- 4. Adicionar configuração de texto do botão de recarga
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'recharge_button_text', 
  '💬 Falar no WhatsApp para Recarga', 
  'Texto exibido no botão de recarga',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  updated_at = NOW();

-- 5. Adicionar configuração de link de extensão
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'extension_whatsapp_link', 
  'https://wa.me/5514991611225?text=Ol%C3%A1%2C%20quero%20fazer%20uma%20recarga%20no%20IA%20PROGRAMADOR', 
  'Link WhatsApp para comprar extensão/licença',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  updated_at = NOW();

-- 6. Adicionar configuração para ativar/desativar botão de extensão
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'extension_button_enabled', 
  'true', 
  'Ativar/desativar botão de comprar extensão (true/false)',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  updated_at = NOW();

-- 7. Adicionar configuração de texto do botão de extensão
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'extension_button_text', 
  '🛒 Comprar Extensão/Licença', 
  'Texto exibido no botão de comprar extensão',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  updated_at = NOW();

-- Nota: Esta migration deve ser executada no Supabase para:
-- 1. Definir Stripe como gateway primário
-- 2. Configurar o link de recarga via WhatsApp
-- 3. Configurar o botão de comprar extensão
