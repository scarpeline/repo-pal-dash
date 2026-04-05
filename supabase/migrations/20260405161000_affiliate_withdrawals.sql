-- Add PIX columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS pix_key_type TEXT;

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    pix_key TEXT NOT NULL,
    pix_key_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own withdrawal requests" 
ON public.withdrawal_requests FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests" 
ON public.withdrawal_requests FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all withdrawal requests" 
ON public.withdrawal_requests FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
    OR auth.jwt() ->> 'email' IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);

CREATE POLICY "Admin can update withdrawal requests" 
ON public.withdrawal_requests FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
    OR auth.jwt() ->> 'email' IN ('escarpelineparticular@gmail.com', 'empresasescarpeline@gmail.com')
);
