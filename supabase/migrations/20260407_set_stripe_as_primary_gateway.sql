-- Migration: Definir Stripe como gateway primário e garantir configurações padrão
-- Executar: npx supabase db push

-- Definir Stripe como gateway primário
INSERT INTO app_settings (key, value, description)
VALUES ('primary_gateway', 'stripe', 'Gateway de pagamento primário: stripe ou asaas')
ON CONFLICT (key) 
DO UPDATE SET value = 'stripe', updated_at = NOW();

-- Garantir que as configurações de WhatsApp existam (mantém valores existentes se houver)
INSERT INTO app_settings (key, value, description)
VALUES 
  ('recharge_whatsapp_link', 'https://wa.me/5514991611225?text=Ol%C3%A1%2C%20quero%20fazer%20uma%20recarga%20no%20IA%20PROGRAMADOR', 'Link WhatsApp para recarga'),
  ('recharge_button_enabled', 'true', 'Se o botão de recarga está ativo'),
  ('recharge_button_text', '💬 Falar no WhatsApp para Recarga', 'Texto do botão de recarga'),
  ('extension_whatsapp_link', 'https://wa.me/5514991611225?text=Ol%C3%A1%2C%20quero%20comprar%20extens%C3%A3o%20no%20IA%20PROGRAMADOR', 'Link WhatsApp para extensão'),
  ('extension_button_enabled', 'true', 'Se o botão de extensão está ativo'),
  ('extension_button_text', '🛒 Comprar Extensão/Licença', 'Texto do botão de extensão')
ON CONFLICT (key) 
DO NOTHING;

-- Confirmar alteração
SELECT key, value FROM app_settings WHERE key = 'primary_gateway';
