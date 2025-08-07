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
$$

-- Trigger function to auto-generate client number
CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.client_number IS NULL OR NEW.client_number = '' THEN
    NEW.client_number := public.generate_client_number();
  END IF;
  RETURN NEW;
END;
$$

-- Create trigger
CREATE TRIGGER trigger_handle_new_client
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_client();

-- Add client_id to orders table
ALTER TABLE public.orders ADD COLUMN client_id UUID REFERENCES public.clients(id);

-- Update requested_date default to now()
ALTER TABLE public.orders ALTER COLUMN requested_date SET DEFAULT now();

-- Change average_service_time to hours (numeric)
ALTER TABLE public.orders ALTER COLUMN average_service_time TYPE NUMERIC(10,2);

-- Update trigger for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();