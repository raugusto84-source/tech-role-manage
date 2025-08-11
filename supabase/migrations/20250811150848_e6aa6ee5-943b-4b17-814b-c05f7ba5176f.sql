-- Crear una función de prueba más simple para verificar si el trigger se ejecuta
CREATE OR REPLACE FUNCTION public.test_trigger_execution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Usar NOTICE para que aparezca en los logs inmediatamente
  RAISE NOTICE 'TRIGGER EXECUTED: Quote % status changed from % to %', NEW.quote_number, OLD.status, NEW.status;
  
  IF NEW.status = 'aceptada' AND (OLD.status IS NULL OR OLD.status != 'aceptada') THEN
    RAISE NOTICE 'TRIGGER CONDITIONS MET: Creating order for quote %', NEW.quote_number;
    -- Solo hacer un NOTICE por ahora para verificar que llega hasta aquí
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear un trigger temporal para probar
DROP TRIGGER IF EXISTS test_trigger_quotes ON public.quotes;
CREATE TRIGGER test_trigger_quotes 
AFTER UPDATE ON public.quotes 
FOR EACH ROW 
EXECUTE FUNCTION test_trigger_execution();