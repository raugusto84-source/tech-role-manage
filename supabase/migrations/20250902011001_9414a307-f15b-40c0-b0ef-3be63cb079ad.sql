-- Create a secure function to resolve email by username for pre-auth login
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM public.profiles
  WHERE username = p_username
  LIMIT 1;
  RETURN v_email; -- can be null if not found
END;
$$;

-- Optionally grant execute to anon/authenticated roles (usually PUBLIC has it, but we ensure it)
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
