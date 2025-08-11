-- Temporarily disable the trigger to isolate the issue
DROP TRIGGER IF EXISTS trigger_create_order_from_approved_quote ON quotes;

-- Add a simple debug trigger instead
CREATE OR REPLACE FUNCTION public.debug_quote_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE LOG 'Quote update: OLD.status=%, NEW.status=%', OLD.status, NEW.status;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER debug_quote_trigger
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.debug_quote_update();