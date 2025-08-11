-- Fix function search path issues for the new functions
DROP FUNCTION IF EXISTS public.generate_purchase_number();
DROP FUNCTION IF EXISTS public.handle_new_purchase();

-- Create function with proper search path
CREATE OR REPLACE FUNCTION public.generate_purchase_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  purchase_count INTEGER;
  purchase_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COUNT(*) + 1 INTO purchase_count
  FROM public.purchases
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  purchase_number := 'COMP-' || current_year || '-' || LPAD(purchase_count::TEXT, 4, '0');
  
  RETURN purchase_number;
END;
$function$;

-- Create trigger function with proper search path
CREATE OR REPLACE FUNCTION public.handle_new_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.purchase_number IS NULL OR NEW.purchase_number = '' THEN
    NEW.purchase_number := public.generate_purchase_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_purchase_number ON public.purchases;
CREATE TRIGGER set_purchase_number
  BEFORE INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_purchase();