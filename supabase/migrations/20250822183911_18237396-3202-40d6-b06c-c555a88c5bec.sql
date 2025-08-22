-- 1) Allow NULL temporarily on orders.service_type so inserts can succeed
ALTER TABLE public.orders
ALTER COLUMN service_type DROP NOT NULL;

-- 2) Create trigger to set orders.service_type from first inserted order_item
CREATE OR REPLACE FUNCTION public.set_order_service_type_from_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only set if currently NULL
  UPDATE public.orders o
  SET service_type = NEW.service_type_id
  WHERE o.id = NEW.order_id AND o.service_type IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_service_type_from_item_trg ON public.order_items;
CREATE TRIGGER set_order_service_type_from_item_trg
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.set_order_service_type_from_item();