-- Apply 2% cashback and rounding to pending_collections totals
-- Update functions to include reward_settings and ceil-to-10 rounding

CREATE OR REPLACE FUNCTION public.manage_pending_collections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  raw_items_total NUMERIC := 0;
  cashback_percent NUMERIC := 0;
  apply_cashback BOOLEAN := false;
  cashback_factor NUMERIC := 1;
  adjusted_total NUMERIC := 0;
  rounded_total NUMERIC := 0;
  order_total NUMERIC := 0;
  client_info RECORD;
BEGIN
  -- Load reward settings (if any)
  SELECT COALESCE(rs.general_cashback_percent, 0), COALESCE(rs.apply_cashback_to_items, false)
  INTO cashback_percent, apply_cashback
  FROM public.reward_settings rs
  WHERE rs.is_active = true
  ORDER BY rs.created_at DESC
  LIMIT 1;

  cashback_factor := CASE WHEN apply_cashback THEN 1 + (cashback_percent / 100.0) ELSE 1 END;

  IF TG_OP = 'UPDATE' THEN
    -- Calculate based on items
    SELECT COALESCE(SUM(oi.total_amount), 0) INTO raw_items_total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;

    adjusted_total := raw_items_total * cashback_factor;
    rounded_total := CEIL(adjusted_total / 10.0) * 10.0;

    -- Fallback to estimated_cost if no items yet
    IF rounded_total = 0 AND NEW.estimated_cost > 0 THEN
      rounded_total := CEIL((NEW.estimated_cost * cashback_factor) / 10.0) * 10.0;
    END IF;

    order_total := GREATEST(rounded_total, 0);

    -- If authorization just changed to true, create/update collection
    IF NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM NEW.client_approval THEN
      SELECT c.name, c.email INTO client_info
      FROM public.clients c
      WHERE c.id = NEW.client_id;

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
        order_total,
        order_total,
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

    ELSIF NEW.client_approval = true THEN
      -- Keep totals in sync if order changes after authorization
      UPDATE public.pending_collections
      SET amount = order_total,
          balance = CASE WHEN balance > order_total THEN order_total ELSE balance END,
          updated_at = now()
      WHERE order_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_pending_collections_on_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_id_val UUID;
  raw_items_total NUMERIC := 0;
  cashback_percent NUMERIC := 0;
  apply_cashback BOOLEAN := false;
  cashback_factor NUMERIC := 1;
  adjusted_total NUMERIC := 0;
  rounded_total NUMERIC := 0;
  order_is_authorized BOOLEAN := false;
BEGIN
  order_id_val := COALESCE(NEW.order_id, OLD.order_id);

  -- Load reward settings
  SELECT COALESCE(rs.general_cashback_percent, 0), COALESCE(rs.apply_cashback_to_items, false)
  INTO cashback_percent, apply_cashback
  FROM public.reward_settings rs
  WHERE rs.is_active = true
  ORDER BY rs.created_at DESC
  LIMIT 1;

  cashback_factor := CASE WHEN apply_cashback THEN 1 + (cashback_percent / 100.0) ELSE 1 END;

  -- Calculate based on items
  SELECT COALESCE(SUM(oi.total_amount), 0) INTO raw_items_total
  FROM public.order_items oi
  WHERE oi.order_id = order_id_val;

  adjusted_total := raw_items_total * cashback_factor;
  rounded_total := CEIL(adjusted_total / 10.0) * 10.0;

  -- Only update if order is authorized
  SELECT COALESCE(o.client_approval, false) INTO order_is_authorized
  FROM public.orders o
  WHERE o.id = order_id_val;

  IF order_is_authorized THEN
    UPDATE public.pending_collections
    SET amount = rounded_total,
        balance = CASE WHEN balance > rounded_total THEN rounded_total ELSE balance END,
        updated_at = now()
    WHERE order_id = order_id_val;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recalculate existing pending collections with cashback and rounding
WITH rs AS (
  SELECT COALESCE(general_cashback_percent, 0) AS percent,
         COALESCE(apply_cashback_to_items, false) AS apply
  FROM public.reward_settings
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1
), items AS (
  SELECT o.id AS order_id,
         COALESCE(SUM(oi.total_amount), 0) AS raw_total
  FROM public.orders o
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  GROUP BY o.id
)
UPDATE public.pending_collections pc
SET amount = CEIL(((items.raw_total * (CASE WHEN rs.apply THEN 1 + (rs.percent/100.0) ELSE 1 END)))/10.0)*10.0,
    balance = LEAST(pc.balance, CEIL(((items.raw_total * (CASE WHEN rs.apply THEN 1 + (rs.percent/100.0) ELSE 1 END)))/10.0)*10.0),
    updated_at = now()
FROM items, rs
WHERE pc.order_id = items.order_id;