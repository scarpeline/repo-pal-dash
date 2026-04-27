-- Migration: Desativar OTP/confirmação de email e permitir cadastro direto
-- Usuários do Google OAuth precisam de sessão imediata sem confirmação

-- Confirmar automaticamente todos os usuários pendentes de confirmação
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = '',
  confirmation_sent_at = NULL
WHERE email_confirmed_at IS NULL;

-- Garantir que novos usuários criados via signUp já venham confirmados
-- Isso é feito via trigger para auto-confirmar no momento do cadastro
CREATE OR REPLACE FUNCTION auth.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;

-- Criar trigger para auto-confirmar novos usuários
CREATE TRIGGER auto_confirm_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.auto_confirm_user();
