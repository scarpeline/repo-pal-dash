CREATE OR REPLACE FUNCTION public.is_admin_email(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT au.email IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
      FROM auth.users au
      WHERE au.id = _user_id
    ),
    false
  );
$$;

DROP POLICY IF EXISTS "Admin can manage leads" ON public.lead_captures;
CREATE POLICY "Admin can manage leads"
ON public.lead_captures
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage packages" ON public.packages;
CREATE POLICY "Admin can manage packages"
ON public.packages
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Anyone can view active packages" ON public.packages;
CREATE POLICY "Anyone can view active packages"
ON public.packages
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Users can view own usage" ON public.token_usage;
CREATE POLICY "Users can view own usage"
ON public.token_usage
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
CREATE POLICY "Admin can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage balances" ON public.balances;
CREATE POLICY "Admin can manage balances"
ON public.balances
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage transactions" ON public.transactions;
CREATE POLICY "Admin can manage transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admin can manage withdrawals"
ON public.withdrawal_requests
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);

DROP POLICY IF EXISTS "Admin can insert notifications" ON public.notifications;
CREATE POLICY "Admin can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_admin_email(auth.uid())
);