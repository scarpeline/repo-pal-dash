# Configuração de Autenticação no Supabase

## 🔧 Problema: Cadastro não funciona / Email de confirmação não chega

### Solução 1: Desativar confirmação de email (Mais rápida)

Se você quer que os usuários possam se cadastrar **sem precisar confirmar email**:

1. Acesse: https://supabase.com/dashboard/project/kcwxjmnwdupcqtofejqj/auth/providers
2. Vá em **Email provider**
3. Desative:
   - ✅ **Confirm email** → **OFF**
   - ✅ **Secure email change** → OFF (opcional)

Isso permite cadastro direto sem envio de email.

---

### Solução 2: Configurar Resend para envio de emails

Se você quer manter a confirmação de email e usar o Resend:

1. **Obter API Key do Resend:**
   - Acesse: https://resend.com/api-keys
   - Crie uma API key

2. **Configurar no Supabase:**
   - Acesse: https://supabase.com/dashboard/project/kcwxjmnwdupcqtofejqj/settings/auth
   - Vá em **Email** (na seção SMTP)
   - Configure:
     ```
     SMTP Host: smtp.resend.com
     SMTP Port: 587
     SMTP User: resend
     SMTP Pass: re_xxxxxxxx (sua API key do Resend)
     Sender Name: IAProgramador
     Sender Email: noreply@iaprogramador.online (ou seu domínio verificado no Resend)
     ```

3. **Verificar domínio no Resend:**
   - Acesse: https://resend.com/domains
   - Adicione seu domínio
   - Configure os registros DNS solicitados

---

### Solução 3: Configuração via SQL (Edge Cases)

Se precisar ajustar via SQL:

```sql
-- Desativar confirmação de email para todos os novos usuários
UPDATE auth.config 
SET confirm_email_enabled = false;
```

⚠️ **Atenção:** Execute apenas se souber o que está fazendo.

---

## 🎯 Recomendação

Para testes rápidos: **Use Solução 1** (desativar confirmação)

Para produção: **Use Solução 2** (configurar Resend)

---

## 🔍 Verificar configuração atual

No SQL Editor do Supabase:

```sql
SELECT * FROM auth.config;
```

Ou verifique em: Authentication > Providers > Email

---

## 📧 Fluxo esperado

### Com confirmação desativada:
```
Usuário preenche cadastro → Conta criada imediatamente → Login automático
```

### Com Resend configurado:
```
Usuário preenche cadastro → Email de confirmação enviado → Usuário clica no link → Conta ativada
```

---

## 🆘 Ainda não funciona?

Verifique os logs:
1. Supabase Dashboard → Logs → Auth
2. Verifique se há erros de SMTP ou de configuração

Ou use login com Google (já implementado) como alternativa!
