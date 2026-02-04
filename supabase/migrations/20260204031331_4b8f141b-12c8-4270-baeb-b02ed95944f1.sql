-- Add column to control whether status change should be triggered
ALTER TABLE public.order_modifications 
ADD COLUMN IF NOT EXISTS skip_status_change boolean DEFAULT false;

-- Update the trigger function to respect skip_status_change
CREATE OR REPLACE FUNCTION public.process_order_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip status change if explicitly requested
  IF NEW.skip_status_change = true THEN
    RETURN NEW;
  END IF;

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