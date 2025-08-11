-- Fix income number generation by creating a function to generate unique income numbers
CREATE OR REPLACE FUNCTION public.generate_income_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  max_income_num INTEGER;
  new_income_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the highest income number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(income_number FROM 'ING-' || current_year || '-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_income_num
  FROM public.incomes
  WHERE income_number LIKE 'ING-' || current_year || '-%';
  
  new_income_number := 'ING-' || current_year || '-' || LPAD(max_income_num::TEXT, 4, '0');
  
  RETURN new_income_number;
END;
$function$;

-- Create trigger to auto-generate income numbers
CREATE OR REPLACE FUNCTION public.handle_new_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.income_number IS NULL OR NEW.income_number = '' THEN
    NEW.income_number := public.generate_income_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS handle_new_income_trigger ON public.incomes;
CREATE TRIGGER handle_new_income_trigger
  BEFORE INSERT ON public.incomes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_income();