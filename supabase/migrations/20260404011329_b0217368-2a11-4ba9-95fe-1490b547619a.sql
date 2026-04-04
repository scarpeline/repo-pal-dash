
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
  
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    SELECT id INTO ref_user_id FROM public.profiles WHERE referral_code = ref_code LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    substr(md5(random()::text), 1, 8),
    ref_user_id
  );
  INSERT INTO public.balances (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;
