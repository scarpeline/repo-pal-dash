# 🎯 Sistema VIP e CTA - Guia Completo

## 📋 Visão Geral

Implementação de 3 sistemas essenciais para o IAProgramador:

1. **🎈 CTA Global Configurável** - Call-to-Action visível em todo o site
2. **👑 Usuários VIP** - Clientes especiais que pagam apenas custo da API
3. **📊 Análise e Sincronização** do Super Admin

---

## 🎈 1. Sistema de CTA (Call-to-Action)

### Funcionalidades

- ✅ Botão configurável visível em todo o site
- ✅ 3 posições disponíveis: Flutuante, Header, Footer
- ✅ Personalização completa: texto, URL, cor
- ✅ Ativar/desativar com um clique
- ✅ Preview em tempo real
- ✅ Botão de fechar (dismiss)
- ✅ Persistência de estado (não mostra novamente na sessão)

### Posições Disponíveis

#### 1. **Flutuante** (Recomendado)
- Canto inferior direito
- Efeito de pulso animado
- Botão de fechar no hover
- Não intrusivo

#### 2. **Header**
- Barra no topo da página
- Ideal para anúncios importantes
- Botão de ação secundário

#### 3. **Footer**
- Barra fixa no rodapé
- Sempre visível ao rolar
- Ótimo para promoções

### Configuração

Acesse: **Super Admin > CTA**

```typescript
// Configurações disponíveis
{
  enabled: boolean,        // Ativar/desativar
  text: string,           // "🚀 Experimente Agora!"
  url: string,            // URL de redirecionamento
  position: string,       // "floating" | "header" | "footer"
  color: string          // Cor hex (#667eea)
}
```

### Exemplos de Uso

**Promoção:**
```
Texto: "🔥 50% OFF - Últimas Horas!"
URL: https://iaprogramador.online/wallet
Posição: Header
Cor: #f5576c
```

**Trial Gratuito:**
```
Texto: "🚀 Teste Grátis por 7 Dias"
URL: https://iaprogramador.online
Posição: Floating
Cor: #667eea
```

**Webinar:**
```
Texto: "📺 Webinar Ao Vivo Agora!"
URL: https://youtube.com/live/...
Posição: Footer
Cor: #ff0000
```

---

## 👑 2. Sistema de Usuários VIP

### O que é um Usuário VIP?

Usuários VIP são clientes especiais que pagam **apenas o custo da API**, sem o markup da plataforma.

### Benefícios para Usuários VIP

- ✅ **Sem markup** - Paga apenas o que a API custa
- ✅ **Markup personalizado** - Configure de 0% a qualquer valor
- ✅ **Prioridade** - Identificação visual com ícone de coroa
- ✅ **Notas administrativas** - Contexto sobre o cliente

### Casos de Uso

1. **Parceiros Estratégicos**
   - Empresas que trazem volume
   - Markup: 0%

2. **Clientes Corporativos**
   - Contratos de longo prazo
   - Markup: 10-20%

3. **Influenciadores/Afiliados**
   - Promovem a plataforma
   - Markup: 0-15%

4. **Beta Testers**
   - Testam novas funcionalidades
   - Markup: 0%

### Como Funciona o Cálculo

#### Usuário Normal
```
Custo API: R$ 0,50
Markup Padrão: 100%
Preço Final: R$ 1,00 (dobro)
Lucro: R$ 0,50
```

#### Usuário VIP (0% markup)
```
Custo API: R$ 0,50
Markup VIP: 0%
Preço Final: R$ 0,50
Lucro: R$ 0,00
```

#### Usuário VIP (20% markup)
```
Custo API: R$ 0,50
Markup VIP: 20%
Preço Final: R$ 0,60
Lucro: R$ 0,10
```

### Gerenciamento de VIPs

Acesse: **Super Admin > Usuários VIP**

#### Adicionar VIP
1. Clique em "Adicionar VIP"
2. Selecione o usuário
3. Configure o markup personalizado (0% = sem markup)
4. Adicione notas (opcional)
5. Salve

#### Editar VIP
1. Clique em "Editar" na linha do usuário
2. Ajuste o markup
3. Atualize as notas
4. Salve

#### Remover VIP
1. Clique em "Remover"
2. Confirme a ação
3. Usuário volta ao markup padrão

### Auditoria

Todas as alterações de status VIP são registradas na tabela `vip_changes_log`:

```sql
SELECT 
  u.email,
  v.old_markup_percent,
  v.new_markup_percent,
  v.notes,
  v.created_at
FROM vip_changes_log v
JOIN profiles u ON u.id = v.user_id
ORDER BY v.created_at DESC;
```

### Função de Cálculo Automático

O sistema usa a função `calculate_user_price()` para calcular automaticamente o preço correto:

```sql
-- Exemplo de uso
SELECT calculate_user_price(
  'user-uuid-here',  -- ID do usuário
  50                 -- Custo da API em centavos
);

-- Retorna: preço final em centavos considerando markup VIP ou padrão
```

---

## 📊 3. Análise do Super Admin

### Funcionalidades Existentes

✅ **Usuários**
- Lista completa de usuários
- Saldo, consumo, depósitos
- Ações rápidas: mensagem, doação, bloqueio

✅ **Preços IA**
- Configuração de preços por modelo
- Custo API vs Preço de revenda
- Ativação/desativação de modelos

✅ **Remarketing**
- Filtros: ativos, inativos, nunca pagaram
- Envio de notificações segmentadas

✅ **Pacotes**
- Criar/editar pacotes de créditos
- Integração Asaas e Stripe
- Links de pagamento

✅ **Saques**
- Solicitações de saque de afiliados
- Aprovação/rejeição

✅ **Calculadora**
- Simulação de custos e lucros
- Análise de margem

✅ **Créditos**
- Adicionar créditos manualmente
- Histórico de transações

✅ **Notificações**
- Envio individual ou em massa
- Templates personalizados

✅ **Configurações**
- Gateway primário (Asaas/Stripe)
- Exibir/ocultar crédito
- Split de pagamento
- Links de WhatsApp

✅ **Saldos IA**
- Monitoramento de saldo das APIs
- Alertas de saldo baixo

### Novas Funcionalidades Adicionadas

✅ **CTA Global**
- Configuração de Call-to-Action
- Preview em tempo real
- Estatísticas (em breve)

✅ **Usuários VIP**
- Gerenciamento de clientes especiais
- Markup personalizado
- Auditoria completa

### Funcionalidades Sugeridas (Roadmap)

#### Curto Prazo
- [ ] Dashboard com métricas principais
- [ ] Gráficos de receita e uso
- [ ] Exportação de relatórios (CSV/PDF)
- [ ] Logs de atividade do admin

#### Médio Prazo
- [ ] Sistema de cupons de desconto
- [ ] Programa de fidelidade
- [ ] Automações (ex: upgrade automático)
- [ ] Integração com CRM

#### Longo Prazo
- [ ] BI completo com Power BI/Metabase
- [ ] Previsão de receita com ML
- [ ] Segmentação avançada de clientes
- [ ] A/B Testing de preços

---

## 🔧 Instalação e Configuração

### 1. Aplicar Migrations

```bash
# Via Supabase CLI
supabase db push

# Ou aplique manualmente no SQL Editor
```

Migrations criadas:
- `20240410000001_cta_and_vip_users.sql`

### 2. Adicionar Componentes ao SuperAdmin

Edite `src/pages/SuperAdmin.tsx` e adicione as novas abas:

```tsx
import SuperAdminVIPTab from "@/components/SuperAdminVIPTab";
import SuperAdminCTATab from "@/components/SuperAdminCTATab";

// Dentro do <TabsList>
<TabsTrigger value="vip" className="flex items-center gap-2">
  <Crown className="w-4 h-4" /> Usuários VIP
</TabsTrigger>
<TabsTrigger value="cta" className="flex items-center gap-2">
  <ExternalLink className="w-4 h-4" /> CTA
</TabsTrigger>

// Dentro do <Tabs>
<TabsContent value="vip">
  <SuperAdminVIPTab />
</TabsContent>

<TabsContent value="cta">
  <SuperAdminCTATab />
</TabsContent>
```

### 3. Verificar Configurações

O CTA já está ativo no `App.tsx`:

```tsx
import GlobalCTA from "@/components/GlobalCTA";

// Dentro do render
<GlobalCTA />
```

---

## 📈 Métricas e KPIs

### Usuários VIP

```sql
-- Total de usuários VIP
SELECT COUNT(*) FROM profiles WHERE is_vip = true;

-- Receita de usuários VIP (últimos 30 dias)
SELECT 
  SUM(amount_cents) / 100 as total_revenue_brl
FROM transactions
WHERE 
  user_id IN (SELECT id FROM profiles WHERE is_vip = true)
  AND type = 'usage'
  AND created_at >= NOW() - INTERVAL '30 days';

-- Markup médio dos VIPs
SELECT AVG(vip_markup_percent) as avg_markup
FROM profiles
WHERE is_vip = true;
```

### CTA

```sql
-- Configuração atual
SELECT * FROM app_settings 
WHERE key LIKE 'cta_%';

-- Tracking de cliques (implementar no futuro)
CREATE TABLE cta_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  cta_text TEXT,
  cta_url TEXT
);
```

---

## 🔒 Segurança

### Permissões

- ✅ Apenas admins podem gerenciar VIPs
- ✅ Apenas admins podem configurar CTA
- ✅ RLS ativado em todas as tabelas
- ✅ Auditoria de todas as alterações VIP

### Validações

```typescript
// Validar markup
if (markup < 0 || markup > 200) {
  throw new Error("Markup deve estar entre 0% e 200%");
}

// Validar URL do CTA
if (!url.startsWith("http")) {
  throw new Error("URL inválida");
}
```

---

## 🐛 Troubleshooting

### CTA não aparece

1. Verificar se está ativado no Super Admin
2. Limpar localStorage: `localStorage.removeItem("cta_dismissed")`
3. Recarregar a página
4. Verificar console do navegador

### Usuário VIP não tem desconto

1. Verificar se `is_vip = true` no banco
2. Verificar `vip_markup_percent` configurado
3. Testar função: `SELECT calculate_user_price('user-id', 100)`
4. Verificar logs de auditoria

### Preços incorretos

```sql
-- Verificar configuração do usuário
SELECT 
  email,
  is_vip,
  vip_markup_percent
FROM profiles
WHERE id = 'user-id';

-- Verificar markup padrão
SELECT value FROM app_settings 
WHERE key = 'default_markup_percent';
```

---

## 💡 Boas Práticas

### Usuários VIP

1. **Documente o motivo** - Sempre adicione notas explicando por que o usuário é VIP
2. **Revise periodicamente** - Verifique se os VIPs ainda fazem sentido
3. **Comunique claramente** - Informe o usuário sobre seus benefícios
4. **Monitore o impacto** - Acompanhe receita vs volume

### CTA

1. **Teste A/B** - Experimente diferentes textos e cores
2. **Seja claro** - Use verbos de ação (Experimente, Comece, Ganhe)
3. **Use emojis** - Chamam mais atenção
4. **Não abuse** - CTA demais cansa o usuário
5. **Meça resultados** - Implemente tracking de cliques

### Super Admin

1. **Backup regular** - Exporte dados importantes
2. **Auditoria** - Revise logs periodicamente
3. **Segurança** - Nunca compartilhe acesso admin
4. **Documentação** - Mantenha este guia atualizado

---

## 📞 Suporte

Para dúvidas ou problemas:
- Email: suporte@iaprogramador.online
- WhatsApp: +55 14 99161-1225

---

**Desenvolvido com ❤️ por O.Scarpeline**
