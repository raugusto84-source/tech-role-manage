-- Add balance field to pending_collections for partial payments
ALTER TABLE public.pending_collections 
ADD COLUMN balance NUMERIC NOT NULL DEFAULT 0;

-- Update existing records to set balance = amount (full pending balance)
UPDATE public.pending_collections 
SET balance = amount 
WHERE balance = 0;

-- Update triggers to also set balance when creating/updating collections
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
      balance = GREATEST(COALESCE(order_total, 0), 0), -- Set initial balance = amount
      updated_at = now()
    WHERE order_id = NEW.id;

    IF NOT FOUND THEN
      INSERT INTO public.pending_collections (
        order_id,
        order_number,
        client_name,
        client_email,
        amount,
        balance, -- Set initial balance = amount
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.order_number,
        COALESCE(client_info.name, 'Cliente'),
        COALESCE(client_info.email, ''),
        GREATEST(COALESCE(order_total, 0), 0),
        GREATEST(COALESCE(order_total, 0), 0), -- Set initial balance = amount
        now(),
        now()
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only update amount and balance on order updates
    UPDATE public.pending_collections
    SET 
      amount = GREATEST(COALESCE(order_total, 0), 0),
      balance = GREATEST(COALESCE(order_total, 0), 0),
      updated_at = now()
    WHERE order_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Also update the items trigger
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
    balance = GREATEST(order_total, 0),
    updated_at = now()
  WHERE order_id = order_info.id;

  RETURN COALESCE(NEW, OLD);
END;
$$;