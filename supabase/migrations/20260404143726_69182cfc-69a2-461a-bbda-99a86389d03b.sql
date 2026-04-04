
DROP POLICY IF EXISTS "Admin can manage leads" ON public.lead_captures;
CREATE POLICY "Admin can manage leads" ON public.lead_captures FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Admin can manage packages" ON public.packages;
CREATE POLICY "Admin can manage packages" ON public.packages FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Users can view own usage" ON public.token_usage;
CREATE POLICY "Users can view own usage" ON public.token_usage FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Admin can manage balances" ON public.balances;
CREATE POLICY "Admin can manage balances" ON public.balances FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Admin can manage transactions" ON public.transactions;
CREATE POLICY "Admin can manage transactions" ON public.transactions FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Admin can manage withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admin can manage withdrawals" ON public.withdrawal_requests FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

DROP POLICY IF EXISTS "Admin can insert notifications" ON public.notifications;
CREATE POLICY "Admin can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);
