-- Función para generar números de póliza con 4 dígitos
CREATE OR REPLACE FUNCTION public.generate_policy_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  max_policy_num INTEGER;
  new_policy_number TEXT;
BEGIN
  -- Obtener el número más alto de póliza actual
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(policy_number FROM 'POL-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_policy_num
  FROM public.insurance_policies
  WHERE policy_number ~ 'POL-[0-9]+$'; -- Solo coincidencias numéricas
  
  -- Generar nuevo número con 4 dígitos
  new_policy_number := 'POL-' || LPAD(max_policy_num::TEXT, 4, '0');
  
  RETURN new_policy_number;
END;
$function$;

-- Trigger para asignar automáticamente el número de póliza
CREATE OR REPLACE FUNCTION public.handle_new_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.policy_number IS NULL OR NEW.policy_number = '' THEN
    NEW.policy_number := public.generate_policy_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS set_policy_number ON public.insurance_policies;
CREATE TRIGGER set_policy_number
  BEFORE INSERT ON public.insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_policy();