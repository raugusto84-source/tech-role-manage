-- Ensure order modifications do NOT override initial pending approval status
CREATE OR REPLACE FUNCTION public.process_order_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only move order to 'pendiente_actualizacion' if it's not awaiting initial approval
  UPDATE public.orders
  SET status = 'pendiente_actualizacion'::order_status,
      updated_at = now()
  WHERE id = NEW.order_id
    AND status NOT IN ('pendiente_aprobacion'::order_status);

  RETURN NEW;
END;
$$;