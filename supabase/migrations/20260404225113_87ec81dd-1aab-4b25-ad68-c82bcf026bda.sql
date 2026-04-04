CREATE TABLE IF NOT EXISTS public.user_ai_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  key_hint TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_ai_api_keys_provider_check CHECK (provider IN ('openai', 'google')),
  CONSTRAINT user_ai_api_keys_user_provider_key UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_api_keys_lookup
  ON public.user_ai_api_keys (user_id, provider, expires_at DESC);

ALTER TABLE public.user_ai_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to user AI API keys" ON public.user_ai_api_keys;

CREATE POLICY "No direct client access to user AI API keys"
ON public.user_ai_api_keys
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);