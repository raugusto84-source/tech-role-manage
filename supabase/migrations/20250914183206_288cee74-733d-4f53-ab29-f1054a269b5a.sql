-- Ensure orders move to 'en_proceso' immediately when a client authorizes
-- Create trigger to update order status on new authorization signature
CREATE OR REPLACE FUNCTION public.activate_order_on_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update order to in-process when a client signs authorization
  UPDATE public.orders
  SET 
    status = 'en_proceso',
    client_approval = true,
    client_approved_at = COALESCE(NEW.signed_at, now()),
    updated_at = now()
  WHERE id = NEW.order_id
    AND status IN ('pendiente', 'pendiente_aprobacion', 'pendiente_actualizacion');

  RETURN NEW;
END;
$$;

-- Create trigger if not exists (drop and recreate safely)
DROP TRIGGER IF EXISTS trg_activate_order_on_authorization ON public.order_authorization_signatures;
CREATE TRIGGER trg_activate_order_on_authorization
AFTER INSERT ON public.order_authorization_signatures
FOR EACH ROW EXECUTE FUNCTION public.activate_order_on_authorization();