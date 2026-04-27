-- Migration: Desativar confirmação de email para cadastro direto
-- Isso permite que usuários se cadastrem sem precisar confirmar email

-- Atualizar configuração de autenticação para não exigir confirmação de email
UPDATE auth.config 
SET 
  confirm_email_enabled = false,
  enable_confirmations = false,
  mailer_autoconfirm = true;

-- Comentário explicativo
COMMENT ON TABLE auth.config IS 'Configuração atualizada: cadastro sem confirmação de email ativado em 2026-04-08';
