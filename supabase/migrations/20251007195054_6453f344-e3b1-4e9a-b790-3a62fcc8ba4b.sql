-- Auto finalize orders when a delivery signature is created
-- Safely create or replace function and trigger

-- Create function
CREATE OR REPLACE FUNCTION public.auto_finalize_order_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Finalize order immediately upon delivery signature, if not already finalized/cancelled
  UPDATE public.orders 
  SET status = 'finalizada'::order_status,
      updated_at = now()
  WHERE id = NEW.order_id
    AND status NOT IN ('finalizada'::order_status, 'cancelada'::order_status);
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present to avoid duplicates
DROP TRIGGER IF EXISTS trg_auto_finalize_order_on_delivery ON public.delivery_signatures;

-- Create trigger to run after inserting a delivery signature
CREATE TRIGGER trg_auto_finalize_order_on_delivery
AFTER INSERT ON public.delivery_signatures
FOR EACH ROW
EXECUTE FUNCTION public.auto_finalize_order_on_delivery();