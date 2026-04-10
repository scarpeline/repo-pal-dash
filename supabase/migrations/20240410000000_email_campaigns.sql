-- Tabela de campanhas de email
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  from_name TEXT DEFAULT 'IAProgramador',
  from_email TEXT DEFAULT 'noreply@iaprogramador.online',
  recipient_filter TEXT DEFAULT 'all', -- all, paid, unpaid, active, inactive, custom
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft', -- draft, sending, completed, failed
  test_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('draft', 'sending', 'completed', 'failed'))
);

-- Tabela de logs de envio
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, bounced, opened, clicked
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_log_status CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'opened', 'clicked'))
);

-- Tabela de templates de email
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  category TEXT DEFAULT 'general', -- general, promotional, transactional, announcement
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON email_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id ON email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- RLS Policies
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver campanhas
CREATE POLICY "Admins can view campaigns" ON email_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert campaigns" ON email_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update campaigns" ON email_campaigns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Logs de email
CREATE POLICY "Admins can view email logs" ON email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert email logs" ON email_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Templates
CREATE POLICY "Admins can manage templates" ON email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Inserir templates padrão
INSERT INTO email_templates (name, description, subject, html_content, category) VALUES
(
  'Boas-vindas',
  'Email de boas-vindas para novos usuários',
  '🚀 Bem-vindo ao IAProgramador!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vindo ao IAProgramador!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{name}}</strong>,</p>
      
      <p>Estamos muito felizes em ter você conosco! 🚀</p>
      
      <p>Com o IAProgramador, você pode:</p>
      <ul>
        <li>✅ Editar qualquer repositório GitHub com IA</li>
        <li>⚡ Usar 6 IAs de elite (Claude, Gemini, DeepSeek, GPT-4o...)</li>
        <li>🎯 Fazer commits automáticos direto no GitHub</li>
        <li>💰 Pagar apenas pelo que usar</li>
      </ul>
      
      <p style="text-align: center;">
        <a href="https://iaprogramador.online" class="button">Começar Agora</a>
      </p>
      
      <p>Qualquer dúvida, estamos à disposição!</p>
      
      <p>Abraços,<br><strong>Equipe IAProgramador</strong></p>
    </div>
    <div class="footer">
      <p>IAProgramador - Programação com Inteligência Artificial</p>
      <p>{{email}}</p>
    </div>
  </div>
</body>
</html>',
  'transactional'
),
(
  'Promoção',
  'Template para campanhas promocionais',
  '🔥 Oferta Especial: 50% OFF em Créditos!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
    .promo-badge { background: #ffd700; color: #333; padding: 10px 20px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
    .content { background: white; padding: 30px; border: 2px solid #f5576c; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #f5576c; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; font-size: 16px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔥 OFERTA RELÂMPAGO!</h1>
      <div class="promo-badge">50% DE DESCONTO</div>
    </div>
    <div class="content">
      <p>Olá <strong>{{name}}</strong>,</p>
      
      <p><strong>Por tempo limitado:</strong> Recarregue sua carteira e ganhe <span style="color: #f5576c; font-weight: bold;">50% de créditos EXTRAS!</span></p>
      
      <p>💰 <strong>Exemplo:</strong></p>
      <ul>
        <li>Recarregue R$ 50 → Receba R$ 75 em créditos</li>
        <li>Recarregue R$ 100 → Receba R$ 150 em créditos</li>
        <li>Recarregue R$ 200 → Receba R$ 300 em créditos</li>
      </ul>
      
      <p>⏰ <strong>Válido apenas nas próximas 48 horas!</strong></p>
      
      <p style="text-align: center;">
        <a href="https://iaprogramador.online/wallet" class="button">APROVEITAR AGORA</a>
      </p>
      
      <p style="font-size: 12px; color: #666;">Esta é uma oferta exclusiva para assinantes. Não perca!</p>
    </div>
    <div class="footer">
      <p>IAProgramador - Programação com Inteligência Artificial</p>
    </div>
  </div>
</body>
</html>',
  'promotional'
),
(
  'Novidades',
  'Anúncio de novas funcionalidades',
  '✨ Novidades no IAProgramador!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; }
    .feature { background: white; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea; border-radius: 5px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Novidades Incríveis!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{name}}</strong>,</p>
      
      <p>Temos novidades empolgantes para você! 🎉</p>
      
      <div class="feature">
        <h3>🚀 Nova IA: Claude Opus 4.6</h3>
        <p>A IA mais poderosa da Anthropic agora disponível! Perfeita para projetos complexos.</p>
      </div>
      
      <div class="feature">
        <h3>⚡ Editor Melhorado</h3>
        <p>Syntax highlighting aprimorado e autocomplete mais inteligente.</p>
      </div>
      
      <div class="feature">
        <h3>💰 Novos Pacotes de Créditos</h3>
        <p>Mais opções e melhores preços para você economizar.</p>
      </div>
      
      <p style="text-align: center;">
        <a href="https://iaprogramador.online" class="button">Experimentar Agora</a>
      </p>
      
      <p>Continue criando projetos incríveis! 💪</p>
    </div>
    <div class="footer">
      <p>IAProgramador - Sempre evoluindo para você</p>
    </div>
  </div>
</body>
</html>',
  'announcement'
);
