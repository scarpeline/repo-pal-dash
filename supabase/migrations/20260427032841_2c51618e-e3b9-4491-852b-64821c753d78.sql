
-- Garantir role admin para os emails autorizados do Super Admin
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email IN ('escarpelineparticular@gmail.com', 'escarpelineparticular2@gmail.com', 'empresasescarpeline@gmail.com')
ON CONFLICT DO NOTHING;

-- Trigger: ao criar novo usuário com um desses emails, atribuir admin automaticamente
CREATE OR REPLACE FUNCTION public.auto_grant_admin_for_whitelisted_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IN ('escarpelineparticular@gmail.com', 'escarpelineparticular2@gmail.com', 'empresasescarpeline@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_grant_admin_whitelist ON auth.users;
CREATE TRIGGER auto_grant_admin_whitelist
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_grant_admin_for_whitelisted_emails();
