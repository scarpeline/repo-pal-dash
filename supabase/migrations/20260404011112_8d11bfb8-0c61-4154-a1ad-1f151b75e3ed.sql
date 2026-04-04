
-- Add pix_key to profiles for withdrawal
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key TEXT DEFAULT NULL;

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  pix_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can view own withdrawal requests
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can insert own withdrawal requests  
CREATE POLICY "Users can request withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Admin profiles select policy (for admin to list all users)
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id 
    OR (SELECT email FROM auth.users WHERE auth.users.id = auth.uid()) = 'escarpelineparticular@gmail.com'
  );

-- Drop old select policy on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
