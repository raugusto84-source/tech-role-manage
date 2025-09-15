-- Fix duplicate pending collections - only create when client approves, not on order creation

-- First, remove any duplicate pending collections (keep the latest one for each order)
DELETE FROM public.pending_collections pc1
WHERE EXISTS (
  SELECT 1 FROM public.pending_collections pc2 
  WHERE pc2.order_id = pc1.order_id 
  AND pc2.created_at > pc1.created_at
);

-- Update trigger to only create collections when client approves, not on order creation
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
  -- Only process when client approves the order (not on order creation)
  IF TG_OP = 'UPDATE' AND NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM NEW.client_approval THEN
    
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

    -- Only proceed if order total is greater than 0
    IF order_total > 0 THEN
      -- Fetch client info once
      SELECT c.name, c.email INTO client_info
      FROM public.clients c
      WHERE c.id = NEW.client_id;

      -- Create or update pending collection
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
      )
      ON CONFLICT (order_id) 
      DO UPDATE SET
        order_number = EXCLUDED.order_number,
        client_name = EXCLUDED.client_name,
        client_email = EXCLUDED.client_email,
        amount = EXCLUDED.amount,
        balance = EXCLUDED.balance,
        updated_at = now();
    END IF;

  -- Handle order items updates (when items change after approval)
  ELSIF TG_OP = 'UPDATE' AND NEW.client_approval = true THEN
    
    -- Calculate totals
    SELECT COALESCE(SUM(total_amount), 0) INTO items_total
    FROM public.order_items
    WHERE order_id = NEW.id;

    order_total := CASE 
      WHEN items_total > 0 THEN items_total
      WHEN NEW.estimated_cost > 0 THEN NEW.estimated_cost
      ELSE 0
    END;

    -- Update existing pending collection if it exists and order total changed
    UPDATE public.pending_collections
    SET 
      amount = GREATEST(order_total, 0),
      balance = GREATEST(order_total, 0),
      updated_at = now()
    WHERE order_id = NEW.id
    AND amount != GREATEST(order_total, 0);

  END IF;

  RETURN NEW;
END;
$$;