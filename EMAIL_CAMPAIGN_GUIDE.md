# 📧 Sistema de Campanhas de Email - IAProgramador

## 🎯 Visão Geral

Sistema completo de email marketing integrado ao IAProgramador, permitindo envio de campanhas segmentadas para assinantes usando Resend API.

## ✨ Funcionalidades

### 1. **Segmentação Avançada**
- ✅ **Todos os usuários** - Enviar para toda a base
- 💰 **Usuários pagantes** - Apenas quem já fez depósito
- 🆓 **Usuários não pagantes** - Leads que ainda não converteram
- 📈 **Ativos** - Usuários que fizeram login nos últimos 30 dias
- 😴 **Inativos** - Usuários sem login há mais de 30 dias
- 📝 **Lista personalizada** - Emails específicos separados por linha

### 2. **Templates Prontos**
- 🎉 **Boas-vindas** - Email de onboarding para novos usuários
- 🔥 **Promoção** - Campanhas promocionais com CTAs fortes
- ✨ **Novidades** - Anúncios de novas funcionalidades

### 3. **Personalização**
- `{{name}}` - Nome do usuário
- `{{email}}` - Email do destinatário
- HTML completo com estilos inline

### 4. **Modo Teste**
- Enviar email apenas para o admin antes de disparar campanha real
- Validar conteúdo e formatação

### 5. **Monitoramento**
- Contador de destinatários em tempo real
- Histórico de campanhas enviadas
- Logs detalhados de envio (sucesso/falha)
- Taxa de entrega por campanha

## 🚀 Como Usar

### Passo 1: Configurar Resend API

1. Acesse [Resend.com](https://resend.com) e crie uma conta
2. Verifique seu domínio (ex: `iaprogramador.online`)
3. Gere uma API Key
4. Configure no Supabase:
   ```bash
   # No dashboard do Supabase > Project Settings > Edge Functions > Secrets
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

### Passo 2: Aplicar Migrations

Execute a migration para criar as tabelas:

```bash
# Via Supabase CLI
supabase db push

# Ou aplique manualmente no SQL Editor do Supabase
```

Tabelas criadas:
- `email_campaigns` - Registro de campanhas
- `email_logs` - Logs de envio individual
- `email_templates` - Templates reutilizáveis

### Passo 3: Acessar o Sistema

1. Faça login como admin
2. Acesse `/email-campaigns` ou clique em "Campanhas de Email" no painel admin
3. Escolha um template ou crie do zero
4. Selecione o público-alvo
5. Ative "Modo teste" para validar
6. Envie a campanha!

## 📊 Estrutura do Banco de Dados

### Tabela: `email_campaigns`
```sql
- id (UUID)
- subject (TEXT) - Assunto do email
- html_content (TEXT) - Conteúdo HTML
- text_content (TEXT) - Versão texto
- from_name (TEXT) - Nome do remetente
- from_email (TEXT) - Email do remetente
- recipient_filter (TEXT) - Filtro aplicado
- recipient_count (INT) - Total de destinatários
- sent_count (INT) - Emails enviados com sucesso
- failed_count (INT) - Emails que falharam
- sent_by (UUID) - Admin que enviou
- status (TEXT) - draft, sending, completed, failed
- test_mode (BOOLEAN) - Se foi teste
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

### Tabela: `email_logs`
```sql
- id (UUID)
- campaign_id (UUID) - Referência à campanha
- recipient_email (TEXT)
- recipient_user_id (UUID)
- status (TEXT) - pending, sent, failed, bounced, opened, clicked
- error_message (TEXT)
- sent_at (TIMESTAMP)
- opened_at (TIMESTAMP)
- clicked_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

### Tabela: `email_templates`
```sql
- id (UUID)
- name (TEXT) - Nome do template
- description (TEXT)
- subject (TEXT)
- html_content (TEXT)
- text_content (TEXT)
- category (TEXT) - general, promotional, transactional, announcement
- is_active (BOOLEAN)
- created_by (UUID)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## 🔧 Edge Function: `send-email-campaign`

### Endpoints

#### 1. Contar Destinatários
```bash
GET /send-email-campaign?action=count&filter=paid
Authorization: Bearer <token>

Response:
{
  "count": 150
}
```

#### 2. Enviar Campanha
```bash
POST /send-email-campaign?action=send
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "🚀 Novidades no IAProgramador!",
  "html_content": "<h1>Olá {{name}}!</h1><p>Temos novidades...</p>",
  "text_content": "Olá {{name}}! Temos novidades...",
  "from_name": "IAProgramador",
  "from_email": "noreply@iaprogramador.online",
  "recipient_filter": "paid",
  "test_mode": false
}

Response:
{
  "success": true,
  "campaign_id": "uuid",
  "results": {
    "total": 150,
    "sent": 148,
    "failed": 2,
    "errors": ["email@exemplo.com: Invalid email"]
  }
}
```

#### 3. Listar Campanhas
```bash
GET /send-email-campaign?action=list
Authorization: Bearer <token>

Response:
{
  "campaigns": [
    {
      "id": "uuid",
      "subject": "Promoção Relâmpago",
      "recipient_count": 200,
      "sent_count": 198,
      "failed_count": 2,
      "status": "completed",
      "created_at": "2024-04-10T10:00:00Z"
    }
  ]
}
```

#### 4. Detalhes da Campanha
```bash
GET /send-email-campaign?action=details&campaign_id=uuid
Authorization: Bearer <token>

Response:
{
  "campaign": { ... },
  "logs": [
    {
      "recipient_email": "user@exemplo.com",
      "status": "sent",
      "sent_at": "2024-04-10T10:05:00Z"
    }
  ]
}
```

## 🎨 Exemplo de Template HTML

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px; 
      text-align: center; 
      border-radius: 10px 10px 0 0; 
    }
    .content { 
      background: #f9f9f9; 
      padding: 30px; 
      border-radius: 0 0 10px 10px; 
    }
    .button { 
      display: inline-block; 
      background: #667eea; 
      color: white; 
      padding: 12px 30px; 
      text-decoration: none; 
      border-radius: 5px; 
      margin: 20px 0; 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vindo, {{name}}!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{name}}</strong>,</p>
      <p>Estamos muito felizes em ter você conosco! 🚀</p>
      <p style="text-align: center;">
        <a href="https://iaprogramador.online" class="button">
          Começar Agora
        </a>
      </p>
    </div>
  </div>
</body>
</html>
```

## 🔒 Segurança

- ✅ Apenas admins podem acessar o sistema
- ✅ RLS (Row Level Security) ativado em todas as tabelas
- ✅ Validação de tokens JWT
- ✅ Rate limiting no envio (10 emails por lote)
- ✅ Logs detalhados de todas as operações

## 📈 Métricas e Analytics

### Métricas Disponíveis
- Total de campanhas enviadas
- Taxa de entrega (sent/total)
- Taxa de falha
- Emails por segmento
- Histórico temporal

### Próximas Implementações
- [ ] Tracking de abertura (open rate)
- [ ] Tracking de cliques (click rate)
- [ ] A/B Testing de assuntos
- [ ] Agendamento de campanhas
- [ ] Automações (triggers)
- [ ] Integração com webhooks do Resend

## 🐛 Troubleshooting

### Email não está sendo enviado

1. **Verificar API Key**
   ```bash
   # No Supabase Dashboard > Edge Functions > Secrets
   RESEND_API_KEY=re_xxxxx
   ```

2. **Verificar domínio no Resend**
   - Acesse Resend Dashboard
   - Verifique se o domínio está verificado (DNS configurado)

3. **Verificar logs**
   ```sql
   SELECT * FROM email_logs 
   WHERE status = 'failed' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

### Emails indo para spam

1. Configure SPF, DKIM e DMARC no DNS
2. Use domínio verificado no Resend
3. Evite palavras spam no assunto
4. Inclua link de descadastro
5. Mantenha lista limpa (remover bounces)

## 💡 Boas Práticas

1. **Sempre teste antes de enviar**
   - Use modo teste para validar
   - Verifique em diferentes clientes de email

2. **Segmente sua audiência**
   - Não envie tudo para todos
   - Personalize mensagens por segmento

3. **Respeite frequência**
   - Não envie emails demais
   - Máximo 2-3 por semana

4. **Monitore métricas**
   - Acompanhe taxa de entrega
   - Ajuste estratégia baseado em dados

5. **Mantenha lista limpa**
   - Remova emails que dão bounce
   - Respeite pedidos de descadastro

## 📞 Suporte

Para dúvidas ou problemas:
- Email: suporte@iaprogramador.online
- WhatsApp: +55 14 99161-1225

---

**Desenvolvido com ❤️ por O.Scarpeline**
