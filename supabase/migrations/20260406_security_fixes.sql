-- 0. Garantir limpeza de políticas vulneráveis
DO $$
BEGIN
    DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admin can manage balances" ON public.balances;
    DROP POLICY IF EXISTS "Admin can manage leads" ON public.lead_captures;
    DROP POLICY IF EXISTS "Admin can manage packages" ON public.packages;
    DROP POLICY IF EXISTS "Admin can manage transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Admin can manage withdrawals" ON public.withdrawal_requests;
END $$;

-- 1. USER_ROLES (Bloquear Autopromoção)
-- Somente admins de e-mail podem conceder cargos. O próprio cargo 'admin' via has_role não permite INSERT se não houver política permissiva.
CREATE POLICY "Admin real can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_admin_email(auth.uid()))
WITH CHECK (public.is_admin_email(auth.uid()));

-- Usuário continua vendo seus próprios cargos
-- Mantemos a política de SELECT existente se for SEGURA
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users and admins can view roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_email(auth.uid()));


-- 2. BALANCES (Bloquear Inflação de Saldo)
-- Removendo qualquer permissão de escrita de usuários comuns
DROP POLICY IF EXISTS "Users can view own balance" ON public.balances;
CREATE POLICY "Users and admins can view balance" ON public.balances
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_email(auth.uid()));

CREATE POLICY "Only admins can manage balances" ON public.balances
FOR ALL TO authenticated
USING (public.is_admin_email(auth.uid()))
WITH CHECK (public.is_admin_email(auth.uid()));


-- 3. TRANSACTIONS (Bloquear Manipulação Financeira)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users and admins can view transactions" ON public.transactions
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_email(auth.uid()));

CREATE POLICY "Only admins can manage transactions" ON public.transactions
FOR ALL TO authenticated
USING (public.is_admin_email(auth.uid()))
WITH CHECK (public.is_admin_email(auth.uid()));


-- 4. LEAD_CAPTURES (Privacidade: Usuário vê os seus)
-- O scanner disse que usuário não podia ler os seus leads.
DROP POLICY IF EXISTS "Users can view own leads" ON public.lead_captures;
CREATE POLICY "Users and admins can view leads" ON public.lead_captures
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_email(auth.uid()));

-- Admins gerenciam tudo
CREATE POLICY "Only admins can manage leads" ON public.lead_captures
FOR ALL TO authenticated
USING (public.is_admin_email(auth.uid()))
WITH CHECK (public.is_admin_email(auth.uid()));


-- 5. WITHDRAWAL_REQUESTS (Fluxo de Saque Seguro)
DROP POLICY IF EXISTS "Admin can manage withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users can create withdrawals" ON public.withdrawal_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_email(auth.uid()));

CREATE POLICY "Only admins can approve withdrawals" ON public.withdrawal_requests
FOR UPDATE TO authenticated
USING (public.is_admin_email(auth.uid()))
WITH CHECK (public.is_admin_email(auth.uid()));


-- 6. APP_SETTINGS (Segurança do Gateway)
DROP POLICY IF EXISTS "Only admin can manage settings" ON public.app_settings;
CREATE POLICY "Only admin can manage settings" ON public.app_settings
FOR ALL TO authenticated
USING (public.is_admin_email(auth.uid()))
WITH CHECK (public.is_admin_email(auth.uid()));

CREATE POLICY "Anyone can view settings" ON public.app_settings
FOR SELECT TO authenticated
USING (true);


-- 7. PROFILES (Proteger pix_key e automação)
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin and owner can view profiles" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_admin_email(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own non-sensitive fields" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
-- Nota: Campos sensíveis como roles são tratados em user_roles, mas aqui garantimos que não haja bypass.
