-- Prevent duplicate cashback when an order is re-finalized after modifications
CREATE OR REPLACE FUNCTION public.process_updated_order_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  client_rewards_record RECORD;
  service_cashback_amount NUMERIC := 0;
  article_cashback_amount NUMERIC := 0;
  service_total NUMERIC := 0;
  article_total NUMERIC := 0;
  referral_record RECORD;
  referrer_bonus NUMERIC := 0;
  new_client_service_discount NUMERIC := 0;
  new_client_article_discount NUMERIC := 0;
  is_validated_client BOOLEAN := false;
  has_existing_cashback BOOLEAN := false;
BEGIN
  -- Only process when order is finalized
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    -- Guard: if cashback already recorded for this order, skip to avoid duplicates
    SELECT EXISTS (
      SELECT 1 FROM public.reward_transactions 
      WHERE order_id = NEW.id 
        AND transaction_type = 'earned'
    ) INTO has_existing_cashback;

    IF has_existing_cashback THEN
      RAISE LOG 'Rewards already processed for order %, skipping duplicate cashback', NEW.order_number;
      RETURN NEW;
    END IF;

    -- Get client rewards record
    SELECT * INTO client_rewards_record 
    FROM public.client_rewards 
    WHERE client_id = NEW.client_id;
    
    -- Check if client is validated (registered on www.login.syslag.com with email and whatsapp)
    SELECT 
      (email_validated AND whatsapp_validated AND registration_source = 'www.login.syslag.com') 
    INTO is_validated_client
    FROM public.client_rewards 
    WHERE client_id = NEW.client_id;
    
    -- Only process rewards for validated clients
    IF is_validated_client THEN
      -- Calculate totals by item type
      SELECT 
        COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN oi.item_type = 'articulo' THEN oi.total_amount ELSE 0 END), 0)
      INTO service_total, article_total
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id;
      
      -- Apply new client discounts (20% services, 5% articles) for first purchase
      IF client_rewards_record.is_new_client AND NOT client_rewards_record.new_client_discount_used THEN
        new_client_service_discount := service_total * 0.20;
        new_client_article_discount := article_total * 0.05;
        
        -- Mark discount as used
        UPDATE public.client_rewards 
        SET new_client_discount_used = true, is_new_client = false, updated_at = now()
        WHERE client_id = NEW.client_id;
        
        -- Record discount transactions
        IF new_client_service_discount > 0 THEN
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, 
            service_discount_percentage, expires_at
          ) VALUES (
            NEW.client_id, 'new_client_service_discount', new_client_service_discount,
            'Descuento 20% servicios - Cliente nuevo en orden #' || NEW.order_number,
            NEW.id, 20, now() + INTERVAL '6 months'
          );
        END IF;
        
        IF new_client_article_discount > 0 THEN
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id,
            article_discount_percentage, expires_at
          ) VALUES (
            NEW.client_id, 'new_client_article_discount', new_client_article_discount,
            'Descuento 5% artículos - Cliente nuevo en orden #' || NEW.order_number,
            NEW.id, 5, now() + INTERVAL '6 months'
          );
        END IF;
      ELSE
        -- Apply regular cashback (5% services, 1% articles) for returning clients
        IF service_total > 0 THEN
          service_cashback_amount := service_total * 0.05;
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, expires_at
          ) VALUES (
            NEW.client_id, 'earned', service_cashback_amount, 
            'Cashback 5% servicios por orden #' || NEW.order_number,
            NEW.id, now() + INTERVAL '6 months'
          );
        END IF;
        
        IF article_total > 0 THEN
          article_cashback_amount := article_total * 0.01;
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, expires_at
          ) VALUES (
            NEW.client_id, 'earned', article_cashback_amount, 
            'Cashback 1% artículos por orden #' || NEW.order_number,
            NEW.id, now() + INTERVAL '6 months'
          );
        END IF;
        
        -- Update client total cashback
        UPDATE public.client_rewards 
        SET total_cashback = total_cashback + service_cashback_amount + article_cashback_amount,
            updated_at = now()
        WHERE client_id = NEW.client_id;
      END IF;
      
      -- Check for referral bonus (5% of services for both referrer and referred)
      SELECT * INTO referral_record 
      FROM public.client_referrals 
      WHERE referred_client_id = NEW.client_id 
      AND referral_bonus_given < 3 
      AND status = 'active';
      
      IF referral_record.id IS NOT NULL AND service_total > 0 THEN
        referrer_bonus := service_total * 0.05;
        
        -- Add referral bonus for referrer
        INSERT INTO public.reward_transactions (
          client_id, transaction_type, amount, description, order_id, expires_at
        ) VALUES (
          referral_record.referrer_client_id, 'referral_bonus', referrer_bonus,
          'Bono 5% por referido - Orden #' || NEW.order_number,
          NEW.id, now() + INTERVAL '6 months'
        );
        
        -- Add referral bonus for referred (first purchase)
        IF client_rewards_record.is_new_client THEN
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, expires_at
          ) VALUES (
            NEW.client_id, 'referral_bonus', referrer_bonus,
            'Bono 5% por ser referido - Orden #' || NEW.order_number,
            NEW.id, now() + INTERVAL '6 months'
          );
        END IF;
        
        -- Update referrer's cashback
        UPDATE public.client_rewards 
        SET total_cashback = total_cashback + referrer_bonus,
            updated_at = now()
        WHERE client_id = referral_record.referrer_client_id;
        
        -- Update referral bonus count
        UPDATE public.client_referrals 
        SET referral_bonus_given = referral_bonus_given + 1
        WHERE id = referral_record.id;
      END IF;
    END IF; -- end validated client
  END IF; -- end status finalized
  
  RETURN NEW;
END;
$function$;