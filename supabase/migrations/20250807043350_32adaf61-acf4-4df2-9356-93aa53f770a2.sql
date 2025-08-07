-- Function to generate client number
CREATE OR REPLACE FUNCTION public.generate_client_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  client_count INTEGER;
  client_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO client_count
  FROM public.clients;
  
  client_number := 'CLI-' || LPAD(client_count::TEXT, 4, '0');
  
  RETURN client_number;
END;
$$;