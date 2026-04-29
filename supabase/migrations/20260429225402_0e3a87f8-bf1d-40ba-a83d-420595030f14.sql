-- Função para verificar se o email é de um admin autorizado
CREATE OR REPLACE FUNCTION public.is_admin_email(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email_to_check IN (
    'empresasescarpeline@gmail.com',
    'sistemasescarpeline@gmail.com',
    'escarpelineparticular@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atribuir role de admin automaticamente no cadastro/login para emails autorizados
CREATE OR REPLACE FUNCTION public.handle_admin_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_admin_email(NEW.email) THEN
    -- Insere ou atualiza para role admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Também garante que tenha role api_cost_only para testes sem limites
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'api_cost_only')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar a trigger na tabela profiles (que é populada via trigger de auth.users)
DROP TRIGGER IF EXISTS on_profile_admin_check ON public.profiles;
CREATE TRIGGER on_profile_admin_check
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_admin_role_assignment();

-- Garantir que os usuários atuais já tenham as permissões
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT id, email FROM public.profiles WHERE public.is_admin_email(email)) LOOP
        INSERT INTO public.user_roles (user_id, role) VALUES (r.id, 'admin') ON CONFLICT DO NOTHING;
        INSERT INTO public.user_roles (user_id, role) VALUES (r.id, 'api_cost_only') ON CONFLICT DO NOTHING;
    END LOOP;
END $$;