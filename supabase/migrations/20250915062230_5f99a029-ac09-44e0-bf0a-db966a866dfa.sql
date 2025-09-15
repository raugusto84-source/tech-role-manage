-- Fix manage_pending_collections function to match actual pending_collections schema
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
  -- Calculate totals based on order items and/or estimated_cost
  SELECT COALESCE(SUM(total_amount), 0) INTO items_total
  FROM public.order_items
  WHERE order_id = NEW.id;

  order_total := COALESCE(NEW.estimated_cost, items_total, 0);

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
      amount = GREATEST(COALESCE(order_total, 0), 0),
      updated_at = now()
    WHERE order_id = NEW.id;

    IF NOT FOUND THEN
      INSERT INTO public.pending_collections (
        order_id,
        order_number,
        client_name,
        client_email,
        amount,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.order_number,
        COALESCE(client_info.name, 'Cliente'),
        COALESCE(client_info.email, ''),
        GREATEST(COALESCE(order_total, 0), 0),
        now(),
        now()
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only update amount and updated_at on order updates
    UPDATE public.pending_collections
    SET 
      amount = GREATEST(COALESCE(order_total, 0), 0),
      updated_at = now()
    WHERE order_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;