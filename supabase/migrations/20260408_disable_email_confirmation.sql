-- Migration: Desativar confirmação de email para cadastro direto
-- Isso permite que usuários se cadastrem sem precisar confirmar email
-- Abordagem: trigger que auto-confirma o email ao criar usuário

-- Criar função que auto-confirma email de novos usuários
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Auto-confirmar email para todos os novos usuários
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(NEW.email_confirmed_at, NOW()),
    confirmation_token = '',
    confirmation_sent_at = NOW()
  WHERE id = NEW.id AND NEW.email_confirmed_at IS NULL;
  
  RETURN NEW;
END;
$$;

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;

-- Criar trigger que executa após INSERT na tabela auth.users
CREATE TRIGGER auto_confirm_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();
