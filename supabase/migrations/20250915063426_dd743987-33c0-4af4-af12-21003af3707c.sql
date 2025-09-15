-- Update existing pending_collections with correct amounts based on order items
UPDATE public.pending_collections pc
SET 
  amount = GREATEST(COALESCE(items_totals.total, 0), 0),
  balance = GREATEST(COALESCE(items_totals.total, 0), 0)
FROM (
  SELECT 
    o.id as order_id,
    COALESCE(SUM(oi.total_amount), 0) as total
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  GROUP BY o.id
) items_totals
WHERE pc.order_id = items_totals.order_id
AND pc.amount = 0;

-- Improved trigger function that prioritizes items total over estimated_cost
CREATE OR REPLACE FUNCTION public.manage_pending_collections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  items_total NUMERIC;
  order_total NUMERIC;
  client_info RECORD;
BEGIN
  -- Calculate totals based on order items first, then estimated_cost as fallback
  SELECT COALESCE(SUM(total_amount), 0) INTO items_total
  FROM public.order_items
  WHERE order_id = NEW.id;

  -- Use items total if available, otherwise estimated_cost, otherwise 0
  order_total := CASE 
    WHEN items_total > 0 THEN items_total
    WHEN NEW.estimated_cost > 0 THEN NEW.estimated_cost
    ELSE 0
  END;

  IF TG_OP = 'INSERT' THEN
    -- Fetch client info once
    SELECT c.name, c.email INTO client_info
    FROM public.clients c
    WHERE c.id = NEW.client_id;

    -- Upsert minimal fields present in pending_collections
    UPDATE public.pending_collections
    SET 
      order_number = NEW.order_number,
      client_name = COALESCE(client_info.name, 'Cliente'),
      client_email = COALESCE(client_info.email, ''),
      amount = GREATEST(order_total, 0),
      balance = GREATEST(order_total, 0),
      updated_at = now()
    WHERE order_id = NEW.id;

    IF NOT FOUND THEN
      INSERT INTO public.pending_collections (
        order_id,
        order_number,
        client_name,
        client_email,
        amount,
        balance,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.order_number,
        COALESCE(client_info.name, 'Cliente'),
        COALESCE(client_info.email, ''),
        GREATEST(order_total, 0),
        GREATEST(order_total, 0),
        now(),
        now()
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update amount and balance when order changes
    UPDATE public.pending_collections
    SET 
      amount = GREATEST(order_total, 0),
      balance = GREATEST(order_total, 0),
      updated_at = now()
    WHERE order_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Improved items trigger that always uses items total
CREATE OR REPLACE FUNCTION public.update_pending_collections_on_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  items_total NUMERIC;
  order_info RECORD;
BEGIN
  SELECT o.id, o.order_number, o.client_id, o.delivery_date, o.estimated_cost
  INTO order_info
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  -- Calculate total from items (always prioritize this over estimated_cost)
  SELECT COALESCE(SUM(total_amount), 0) INTO items_total
  FROM public.order_items
  WHERE order_id = order_info.id;

  -- Update pending_collections with items total
  UPDATE public.pending_collections
  SET 
    amount = GREATEST(items_total, 0),
    balance = GREATEST(items_total, 0),
    updated_at = now()
  WHERE order_id = order_info.id;

  RETURN COALESCE(NEW, OLD);
END;
$$;