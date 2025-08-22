-- Ensure non-null service_type on orders inserts
-- 1) Add a default value
ALTER TABLE public.orders
ALTER COLUMN service_type SET DEFAULT 'servicio_programado';

-- 2) Create a trigger to enforce a non-null value even if explicitly set to NULL
CREATE OR REPLACE FUNCTION public.ensure_order_service_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_type IS NULL OR trim(NEW.service_type) = '' THEN
    NEW.service_type := 'servicio_programado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_order_service_type_before_insert ON public.orders;
CREATE TRIGGER ensure_order_service_type_before_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_service_type();