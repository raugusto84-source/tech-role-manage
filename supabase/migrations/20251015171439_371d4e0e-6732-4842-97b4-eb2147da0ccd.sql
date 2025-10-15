-- Make client_number have a default empty value
ALTER TABLE public.clients 
ALTER COLUMN client_number SET DEFAULT '';

-- Drop existing function first
DROP FUNCTION IF EXISTS public.generate_client_number();

-- Create new trigger function that generates client numbers
CREATE OR REPLACE FUNCTION public.generate_client_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  new_client_number TEXT;
BEGIN
  -- Only generate if client_number is empty or null
  IF NEW.client_number IS NULL OR NEW.client_number = '' THEN
    -- Get the next sequential number
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(client_number FROM 'CLI-(\d+)') AS INTEGER)), 
      0
    ) + 1 INTO next_number
    FROM public.clients
    WHERE client_number ~ '^CLI-\d+$';
    
    -- Format as CLI-XXXX (padded to 4 digits)
    new_client_number := 'CLI-' || LPAD(next_number::TEXT, 4, '0');
    
    NEW.client_number := new_client_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_client_number ON public.clients;
CREATE TRIGGER set_client_number
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_number();