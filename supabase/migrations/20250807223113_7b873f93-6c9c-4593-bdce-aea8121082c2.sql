-- Enable pgcrypto extension for secure token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Ensure generate_survey_token uses schema-qualified function and safe search_path
CREATE OR REPLACE FUNCTION public.generate_survey_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(public.gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;