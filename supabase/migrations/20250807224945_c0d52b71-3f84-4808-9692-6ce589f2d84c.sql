-- Use extensions schema explicitly for token generation
CREATE OR REPLACE FUNCTION public.generate_survey_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(extensions.gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;