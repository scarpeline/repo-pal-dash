
-- Create user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'affiliate');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can view own roles, admin can view all
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create lead_captures table for remarketing
CREATE TABLE public.lead_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  whatsapp TEXT,
  source TEXT DEFAULT 'signup',
  status TEXT NOT NULL DEFAULT 'active',
  first_login_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  has_paid BOOLEAN DEFAULT false,
  total_paid_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage leads" ON public.lead_captures
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = 'escarpelineparticular@gmail.com'::text)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = 'escarpelineparticular@gmail.com'::text);

CREATE POLICY "Users can insert own lead" ON public.lead_captures
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lead" ON public.lead_captures
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Create packages table
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credits_amount INTEGER NOT NULL,
  price_brl INTEGER NOT NULL,
  asaas_plan_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages" ON public.packages
  FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR (( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = 'escarpelineparticular@gmail.com'::text);

CREATE POLICY "Admin can manage packages" ON public.packages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = 'escarpelineparticular@gmail.com'::text)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = 'escarpelineparticular@gmail.com'::text);

-- Create token_usage table
CREATE TABLE public.token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.token_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR (( SELECT users.email FROM auth.users WHERE users.id = auth.uid()))::text = 'escarpelineparticular@gmail.com'::text);

CREATE POLICY "System can insert usage" ON public.token_usage
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add affiliate_code to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='affiliate_code') THEN
    ALTER TABLE public.profiles ADD COLUMN affiliate_code TEXT;
  END IF;
END $$;

-- Add transaction_id to affiliate_commissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliate_commissions' AND column_name='transaction_id') THEN
    ALTER TABLE public.affiliate_commissions ADD COLUMN transaction_id UUID REFERENCES public.transactions(id);
  END IF;
END $$;

-- Generate affiliate code function
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
BEGIN
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE affiliate_code = new_code);
  END LOOP;
  RETURN new_code;
END;
$$;

-- Insert admin role for super admin user (if exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'escarpelineparticular@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Update handle_new_user to also create lead_capture
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_user_id UUID;
  ref_code TEXT;
BEGIN
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NULL THEN
    ref_code := NEW.raw_user_meta_data->>'ref_code';
  END IF;
  
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    SELECT id INTO ref_user_id FROM public.profiles WHERE referral_code = ref_code OR affiliate_code = ref_code LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, referral_code, referred_by, affiliate_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    substr(md5(random()::text), 1, 8),
    ref_user_id,
    NULL
  );
  
  INSERT INTO public.balances (user_id) VALUES (NEW.id);
  
  INSERT INTO public.lead_captures (user_id, email, source, status, has_paid)
  VALUES (NEW.id, NEW.email, 'signup', 'active', false);
  
  RETURN NEW;
END;
$function$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
