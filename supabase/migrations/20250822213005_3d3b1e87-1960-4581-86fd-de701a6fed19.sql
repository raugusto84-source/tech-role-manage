-- Fix: Exclude policy orders from being moved to 'pendiente_actualizacion' status
-- Policy orders should remain in 'pendiente' status once created

CREATE OR REPLACE FUNCTION public.process_order_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only move order to 'pendiente_actualizacion' if:
  -- 1. It's not awaiting initial approval
  -- 2. It's not a policy order (policy orders should stay 'pendiente')
  UPDATE public.orders
  SET status = 'pendiente_actualizacion'::order_status,
      updated_at = now()
  WHERE id = NEW.order_id
    AND status NOT IN ('pendiente_aprobacion'::order_status)
    AND (is_policy_order IS NULL OR is_policy_order = false);

  RETURN NEW;
END;
$$;