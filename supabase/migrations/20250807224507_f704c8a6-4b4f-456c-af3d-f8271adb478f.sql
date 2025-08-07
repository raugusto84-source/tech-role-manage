-- Fix token generation to use Supabase extensions schema
CREATE OR REPLACE FUNCTION public.generate_survey_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $$
DECLARE
  token TEXT;
BEGIN
  -- gen_random_bytes is provided by pgcrypto in the `extensions` schema on Supabase
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;