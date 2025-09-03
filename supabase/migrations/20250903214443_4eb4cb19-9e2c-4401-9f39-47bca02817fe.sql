-- Update rewards logic: 10% cashback on services for first purchase, then 2% on every subsequent purchase (total of services + articles). Remove referral and other bonuses.

-- Update function: process_updated_order_rewards
CREATE OR REPLACE FUNCTION public.process_updated_order_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_total NUMERIC := 0;
  article_total NUMERIC := 0;
  total_amount NUMERIC := 0;
  cashback_amount NUMERIC := 0;
  is_first_purchase BOOLEAN := false;
BEGIN
  -- Only process when order is finalized
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    -- Calculate totals by item type
    SELECT 
      COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN oi.item_type = 'articulo' THEN oi.total_amount ELSE 0 END), 0)
    INTO service_total, article_total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;

    total_amount := service_total + article_total;

    -- Determine if first purchase based on client_rewards flags
    SELECT (cr.is_new_client = true AND cr.new_client_discount_used = false)
    INTO is_first_purchase
    FROM public.client_rewards cr
    WHERE cr.client_id = NEW.client_id;

    -- Compute cashback
    IF is_first_purchase THEN
      -- 10% on services for first purchase
      cashback_amount := service_total * 0.10;

      -- Mark client as no longer new and discount used
      UPDATE public.client_rewards 
      SET new_client_discount_used = true, is_new_client = false, updated_at = now()
      WHERE client_id = NEW.client_id;

      IF cashback_amount > 0 THEN
        INSERT INTO public.reward_transactions (
          client_id, transaction_type, amount, description, order_id, expires_at
        ) VALUES (
          NEW.client_id, 'earned', cashback_amount,
          'Cashback 10% en servicios - Primera compra - Orden #' || NEW.order_number,
          NEW.id, now() + INTERVAL '1 year'
        );
      END IF;
    ELSE
      -- 2% on every subsequent purchase (services + articles)
      IF total_amount > 0 THEN
        cashback_amount := total_amount * 0.02;
        INSERT INTO public.reward_transactions (
          client_id, transaction_type, amount, description, order_id, expires_at
        ) VALUES (
          NEW.client_id, 'earned', cashback_amount,
          'Cashback 2% por compra - Orden #' || NEW.order_number,
          NEW.id, now() + INTERVAL '1 year'
        );
      END IF;
    END IF;

    -- Update client total cashback
    IF cashback_amount > 0 THEN
      UPDATE public.client_rewards 
      SET total_cashback = COALESCE(total_cashback, 0) + cashback_amount,
          updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update function: process_order_rewards (keep same behavior for consistency)
CREATE OR REPLACE FUNCTION public.process_order_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_total NUMERIC := 0;
  article_total NUMERIC := 0;
  total_amount NUMERIC := 0;
  cashback_amount NUMERIC := 0;
  is_first_purchase BOOLEAN := false;
BEGIN
  -- Only process when order is finalized
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    -- Calculate totals by item type
    SELECT 
      COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN oi.item_type = 'articulo' THEN oi.total_amount ELSE 0 END), 0)
    INTO service_total, article_total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;

    total_amount := service_total + article_total;

    -- Determine if first purchase based on client_rewards flags
    SELECT (cr.is_new_client = true AND cr.new_client_discount_used = false)
    INTO is_first_purchase
    FROM public.client_rewards cr
    WHERE cr.client_id = NEW.client_id;

    -- Compute cashback
    IF is_first_purchase THEN
      cashback_amount := service_total * 0.10; -- 10% services first purchase
      UPDATE public.client_rewards 
      SET new_client_discount_used = true, is_new_client = false, updated_at = now()
      WHERE client_id = NEW.client_id;

      IF cashback_amount > 0 THEN
        INSERT INTO public.reward_transactions (
          client_id, transaction_type, amount, description, order_id, expires_at
        ) VALUES (
          NEW.client_id, 'earned', cashback_amount,
          'Cashback 10% en servicios - Primera compra - Orden #' || NEW.order_number,
          NEW.id, now() + INTERVAL '1 year'
        );
      END IF;
    ELSE
      IF total_amount > 0 THEN
        cashback_amount := total_amount * 0.02; -- 2% subsequent purchases
        INSERT INTO public.reward_transactions (
          client_id, transaction_type, amount, description, order_id, expires_at
        ) VALUES (
          NEW.client_id, 'earned', cashback_amount,
          'Cashback 2% por compra - Orden #' || NEW.order_number,
          NEW.id, now() + INTERVAL '1 year'
        );
      END IF;
    END IF;

    -- Update client total cashback
    IF cashback_amount > 0 THEN
      UPDATE public.client_rewards 
      SET total_cashback = COALESCE(total_cashback, 0) + cashback_amount,
          updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;