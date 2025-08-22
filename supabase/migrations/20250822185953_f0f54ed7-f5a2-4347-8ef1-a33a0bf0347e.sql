-- Ensure orders from policy services default to status 'pendiente'
-- 1) Set a safe default at the column level
ALTER TABLE public.orders
ALTER COLUMN status SET DEFAULT 'pendiente'::order_status;

-- 2) Add a BEFORE INSERT trigger to enforce default when NULL (does not override explicit statuses)
CREATE OR REPLACE FUNCTION public.set_orders_status_pending_when_null()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := 'pendiente'::order_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_orders_status_pending_when_null_trg ON public.orders;
CREATE TRIGGER set_orders_status_pending_when_null_trg
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_orders_status_pending_when_null();