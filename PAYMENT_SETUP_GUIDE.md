# 🚀 Guia Completo: Configurar Pagamentos (Stripe + Asaas)

## ✅ Checklist de Configuração

### 1. Configurar Secrets no Lovable.dev

Acesse: **Project Settings > Secrets**

#### Stripe (Obrigatório para cartão internacional)
- [ ] `STRIPE_SECRET_KEY` - Chave secreta do Stripe (começa com `sk_test_` ou `sk_live_`)
  - Obtida em: https://dashboard.stripe.com/apikeys
- [ ] `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
  - Obtida ao configurar webhook no Stripe (veja passo 2)
- [ ] `STRIPE_PUBLISHABLE_KEY` - Chave pública (começa com `pk_test_` ou `pk_live_`)

#### Asaas (Obrigatório para PIX no Brasil)
- [ ] `ASAAS_API_KEY` - Chave API de produção do Asaas
  - Obtida em: https://app.asaas.com/ajuda/api (Configurações > API)
- [ ] `ASAAS_SANDBOX_API_KEY` - Chave API de sandbox (testes)
  - Obtida em: https://sandbox.asaas.com/ajuda/api
- [ ] `ASAAS_MODE` - Definir como `sandbox` (testes) ou `production`

#### Supabase (Deve já existir)
- [ ] `SUPABASE_URL` - URL do projeto Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key do Supabase

---

### 2. Configurar Webhooks

#### Stripe Webhook
```
URL: https://kcwxjmnwdupcqtofejqj.supabase.co/functions/v1/stripe-payment?action=webhook
Eventos: checkout.session.completed, payment_intent.payment_failed
```

Passo a passo:
1. Acesse https://dashboard.stripe.com/webhooks
2. Clique "Add endpoint"
3. Cole a URL acima
4. Selecione os eventos:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
5. Salve e copie o **Signing Secret**
6. Configure no Lovable: `STRIPE_WEBHOOK_SECRET`

#### Asaas Webhook (opcional, para confirmação automática)
```
URL: https://kcwxjmnwdupcqtofejqj.supabase.co/functions/v1/asaas-payment?action=webhook
Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED
```

Passo a passo:
1. Acesse https://app.asaas.com/configuracoes/webhooks
2. Adicione a URL acima
3. Selecione os eventos de pagamento confirmado

---

### 3. Criar Produtos/Pacotes

#### No SuperAdmin (recomendado)
1. Acesse `/superadmin` como admin
2. Vá na aba "Pacotes"
3. Clique "Novo" para criar pacotes
4. Defina:
   - Nome do pacote
   - Valor em Reais (ex: 10.00 = R$ 10,00)
   - Stripe Price ID (opcional - veja passo 4)
   - Asaas Link ID (opcional - veja passo 5)

#### Exemplo de valores:
- Pacote R$ 10,00 → 1000 centavos → R$ 10,00 de saldo
- Pacote R$ 50,00 → 5000 centavos → R$ 50,00 de saldo

---

### 4. Configurar Produtos no Stripe (opcional)

Se quiser usar produtos predefinidos do Stripe:

1. Acesse https://dashboard.stripe.com/products
2. Crie um produto:
   - Nome: "Pacote Starter"
   - Preço: R$ 10,00 (moeda BRL)
   - Tipo: Preço padrão
3. Copie o **Price ID** (começa com `price_`)
4. Cole no campo "Stripe Price ID" no SuperAdmin

---

### 5. Configurar Links de Pagamento no Asaas (opcional)

1. Acesse https://app.asaas.com/links-de-pagamento
2. Crie um link de pagamento
3. Copie o **ID do Link**
4. Cole no campo "Asaas Link ID" no SuperAdmin

---

### 6. Aplicar Migrations no Banco

Execute as migrations para garantir que as tabelas estão corretas:

```bash
# No terminal do projeto
npx supabase db push
```

Ou execute manualmente no SQL Editor do Supabase:

```sql
-- Garantir que tabela de pacotes tem campos necessários
ALTER TABLE packages 
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_link_id TEXT;

-- Garantir que tabela de transações tem campo de gateway
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'stripe';

-- Configurar Stripe como gateway primário
INSERT INTO app_settings (key, value) 
VALUES ('primary_gateway', 'stripe')
ON CONFLICT (key) DO UPDATE SET value = 'stripe';
```

---

### 7. Testar Fluxo de Pagamento

#### Teste com Stripe (modo teste):
1. Configure `STRIPE_SECRET_KEY` com chave de teste (`sk_test_...`)
2. No frontend, vá em "Carteira"
3. Selecione um pacote ou recarga personalizada
4. Use cartão de teste: `4242 4242 4242 4242`
   - Data futura qualquer
   - CVC qualquer
   - CEP qualquer
5. Complete o pagamento
6. Verifique se o saldo foi creditado automaticamente

#### Teste com Asaas (modo sandbox):
1. Configure `ASAAS_MODE=sandbox`
2. Configure `ASAAS_SANDBOX_API_KEY`
3. Faça uma recarga
4. Use dados de teste do Asaas
5. Confirme o pagamento no dashboard sandbox

---

## 🔧 Resolução de Problemas

### Erro: "STRIPE_SECRET_KEY não configurada"
**Solução:** Configure a secret `STRIPE_SECRET_KEY` no Lovable.dev

### Erro: "Webhook secret não configurado"
**Solução:** Configure a secret `STRIPE_WEBHOOK_SECRET` com o signing secret do webhook

### Pagamento não credita automaticamente
**Causas comuns:**
1. Webhook não configurado corretamente
2. `STRIPE_WEBHOOK_SECRET` incorreto
3. URL do webhook errada
4. Evento `checkout.session.completed` não selecionado

**Verificação manual:**
```sql
-- Verificar transações pendentes
SELECT * FROM transactions 
WHERE status = 'pending' 
AND payment_gateway = 'stripe';
```

### Gateway não aparece como Stripe
**Solução:**
```sql
-- Verificar configuração atual
SELECT * FROM app_settings WHERE key = 'primary_gateway';

-- Forçar Stripe como primário
UPDATE app_settings 
SET value = 'stripe' 
WHERE key = 'primary_gateway';
```

---

## 📊 URLs Importantes

| Serviço | URL |
|---------|-----|
| Stripe Webhook | `https://kcwxjmnwdupcqtofejqj.supabase.co/functions/v1/stripe-payment?action=webhook` |
| Asaas Webhook | `https://kcwxjmnwdupcqtofejqj.supabase.co/functions/v1/asaas-payment?action=webhook` |
| Supabase Project | `https://kcwxjmnwdupcqtofejqj.supabase.co` |
| Stripe Dashboard | `https://dashboard.stripe.com` |
| Asaas Dashboard | `https://app.asaas.com` |

---

## 💡 Dicas

1. **Sempre use modo sandbox/teste primeiro** antes de ativar produção
2. **Guarde as chaves de API em local seguro** - não compartilhe em código público
3. **Teste o webhook com eventos de teste** no dashboard do Stripe
4. **Monitore as Edge Functions logs** no Supabase para debug
5. **Configure comissões de afiliados** se necessário (já implementado 30%)

---

## 🆘 Precisa de ajuda?

- Stripe Docs: https://stripe.com/docs
- Asaas Docs: https://asaas.com/documentacao
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
