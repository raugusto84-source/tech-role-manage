-- Fix cashback calculation to use configured percentages from reward_settings

CREATE OR REPLACE FUNCTION public.process_order_cashback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_total NUMERIC := 0;
  article_total NUMERIC := 0;
  cashback_amount NUMERIC := 0;
  already_exists BOOLEAN := false;
  reward_settings_record RECORD;
  client_rewards_record RECORD;
  applicable_cashback_percent NUMERIC := 0;
BEGIN
  -- Only when status changes to finalizada
  IF NEW.status = 'finalizada' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Idempotency: skip if an 'earned' record already exists for this order
    SELECT EXISTS(
      SELECT 1 FROM public.reward_transactions rt 
      WHERE rt.order_id = NEW.id AND rt.transaction_type = 'earned'
    ) INTO already_exists;

    IF already_exists THEN
      RETURN NEW;
    END IF;

    -- Get active reward settings
    SELECT * INTO reward_settings_record
    FROM public.reward_settings 
    WHERE is_active = true
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
    
    -- Get client rewards info to determine if new client
    SELECT * INTO client_rewards_record
    FROM public.client_rewards
    WHERE client_id = NEW.client_id;

    -- Determine applicable cashback percentage
    IF client_rewards_record.is_new_client AND NOT client_rewards_record.new_client_discount_used THEN
      -- New client - use new_client_cashback_percent
      applicable_cashback_percent := COALESCE(reward_settings_record.new_client_cashback_percent, 2.0);
      
      -- Mark new client discount as used
      UPDATE public.client_rewards 
      SET new_client_discount_used = true, updated_at = now()
      WHERE client_id = NEW.client_id;
    ELSE
      -- Existing client - use general_cashback_percent
      applicable_cashback_percent := COALESCE(reward_settings_record.general_cashback_percent, 2.0);
    END IF;

    -- Sum totals by item type
    SELECT 
      COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN oi.item_type = 'articulo' THEN oi.total_amount ELSE 0 END), 0)
    INTO service_total, article_total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;

    -- Calculate cashback using configured percentage for both services and articles
    cashback_amount := (service_total + article_total) * (applicable_cashback_percent / 100.0);

    IF cashback_amount > 0 THEN
      INSERT INTO public.reward_transactions (
        client_id, transaction_type, amount, description, order_id, expires_at
      ) VALUES (
        NEW.client_id, 'earned', cashback_amount,
        'Cashback por orden #' || NEW.order_number || ' (' || applicable_cashback_percent || '%)',
        NEW.id, now() + INTERVAL '1 year'
      );

      -- Update cached total cashback
      UPDATE public.client_rewards 
      SET total_cashback = COALESCE(total_cashback, 0) + cashback_amount,
          updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;