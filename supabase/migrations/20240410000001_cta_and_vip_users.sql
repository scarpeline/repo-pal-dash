-- Adicionar configurações de CTA (Call-to-Action)
INSERT INTO app_settings (key, value, description) VALUES
  ('cta_enabled', 'true', 'Habilitar botão CTA global'),
  ('cta_text', '🚀 Experimente Agora Grátis!', 'Texto do botão CTA'),
  ('cta_url', 'https://iaprogramador.online', 'URL de redirecionamento do CTA'),
  ('cta_position', 'header', 'Posição do CTA: header, footer, floating'),
  ('cta_color', '#667eea', 'Cor do botão CTA')
ON CONFLICT (key) DO NOTHING;

-- Adicionar coluna is_vip na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vip_markup_percent NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vip_notes TEXT;

-- Comentários
COMMENT ON COLUMN profiles.is_vip IS 'Usuário VIP paga apenas custo da API sem markup';
COMMENT ON COLUMN profiles.vip_markup_percent IS 'Markup personalizado para usuário VIP (0 = sem markup)';
COMMENT ON COLUMN profiles.vip_notes IS 'Notas administrativas sobre o usuário VIP';

-- Índice para buscar usuários VIP rapidamente
CREATE INDEX IF NOT EXISTS idx_profiles_is_vip ON profiles(is_vip) WHERE is_vip = true;

-- Adicionar configurações de preços padrão
INSERT INTO app_settings (key, value, description) VALUES
  ('default_markup_percent', '100', 'Markup padrão sobre custo da API (100% = dobro do custo)'),
  ('vip_discount_percent', '0', 'Desconto adicional para usuários VIP'),
  ('free_trial_credits', '1000', 'Créditos gratuitos para novos usuários (em centavos)')
ON CONFLICT (key) DO NOTHING;

-- Tabela de histórico de alterações VIP (auditoria)
CREATE TABLE IF NOT EXISTS vip_changes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_is_vip BOOLEAN,
  new_is_vip BOOLEAN,
  old_markup_percent NUMERIC,
  new_markup_percent NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_vip_changes_user_id ON vip_changes_log(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_changes_created_at ON vip_changes_log(created_at DESC);

-- RLS para vip_changes_log
ALTER TABLE vip_changes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view vip changes" ON vip_changes_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert vip changes" ON vip_changes_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Função para calcular preço com markup personalizado
CREATE OR REPLACE FUNCTION calculate_user_price(
  p_user_id UUID,
  p_api_cost_cents INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_is_vip BOOLEAN;
  v_markup_percent NUMERIC;
  v_default_markup NUMERIC;
  v_final_price INTEGER;
BEGIN
  -- Buscar configurações do usuário
  SELECT is_vip, vip_markup_percent 
  INTO v_is_vip, v_markup_percent
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Se não encontrou usuário, usar markup padrão
  IF NOT FOUND THEN
    SELECT COALESCE(value::NUMERIC, 100) 
    INTO v_default_markup
    FROM app_settings 
    WHERE key = 'default_markup_percent';
    
    v_markup_percent := v_default_markup;
  ELSIF v_is_vip THEN
    -- Usuário VIP usa markup personalizado (pode ser 0)
    v_markup_percent := COALESCE(v_markup_percent, 0);
  ELSE
    -- Usuário normal usa markup padrão
    SELECT COALESCE(value::NUMERIC, 100) 
    INTO v_default_markup
    FROM app_settings 
    WHERE key = 'default_markup_percent';
    
    v_markup_percent := v_default_markup;
  END IF;
  
  -- Calcular preço final
  v_final_price := CEIL(p_api_cost_cents * (1 + v_markup_percent / 100.0));
  
  RETURN v_final_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário na função
COMMENT ON FUNCTION calculate_user_price IS 'Calcula preço final para usuário considerando markup VIP ou padrão';

-- View para relatório de usuários VIP
CREATE OR REPLACE VIEW vip_users_report AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.is_vip,
  p.vip_markup_percent,
  p.vip_notes,
  b.balance_cents,
  b.total_spent_cents,
  b.total_deposited_cents,
  p.created_at,
  (
    SELECT COUNT(*) 
    FROM transactions t 
    WHERE t.user_id = p.id 
    AND t.type = 'usage'
  ) as total_transactions,
  (
    SELECT MAX(created_at) 
    FROM transactions t 
    WHERE t.user_id = p.id
  ) as last_transaction_at
FROM profiles p
LEFT JOIN balances b ON b.user_id = p.id
WHERE p.is_vip = true
ORDER BY p.created_at DESC;

-- Comentário na view
COMMENT ON VIEW vip_users_report IS 'Relatório consolidado de usuários VIP';

-- Inserir alguns usuários VIP de exemplo (comentado - descomente se quiser testar)
-- UPDATE profiles SET is_vip = true, vip_markup_percent = 0, vip_notes = 'Usuário VIP - Sem markup' WHERE email = 'vip@exemplo.com';
