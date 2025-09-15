-- Fix update_pending_collections_on_items function to match actual pending_collections schema
CREATE OR REPLACE FUNCTION public.update_pending_collections_on_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  items_total NUMERIC;
  order_total NUMERIC;
  order_info RECORD;
BEGIN
  SELECT o.id, o.order_number, o.client_id, o.delivery_date, o.estimated_cost
  INTO order_info
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  -- Calculate total from items
  SELECT COALESCE(SUM(total_amount), 0) INTO items_total
  FROM public.order_items
  WHERE order_id = order_info.id;

  -- Prefer agreed total (estimated_cost) if exists, otherwise use items sum
  order_total := COALESCE(order_info.estimated_cost, items_total, 0);

  -- Update only the fields that exist in pending_collections
  UPDATE public.pending_collections
  SET 
    amount = GREATEST(order_total, 0),
    updated_at = now()
  WHERE order_id = order_info.id;

  RETURN COALESCE(NEW, OLD);
END;
$$;