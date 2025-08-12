-- Fix security issues by adding search_path to functions
CREATE OR REPLACE FUNCTION public.initialize_client_rewards()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.client_rewards (client_id, is_new_client)
  VALUES (NEW.id, true)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := 'REF' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.client_referrals WHERE referral_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_order_rewards()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  client_rewards_record RECORD;
  cashback_amount NUMERIC := 0;
  referral_record RECORD;
  referrer_bonus NUMERIC := 0;
  service_total NUMERIC := 0;
BEGIN
  -- Only process when order is finalized
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Get client rewards record
    SELECT * INTO client_rewards_record 
    FROM public.client_rewards 
    WHERE client_id = NEW.client_id;
    
    -- Calculate total from service items only (for cashback)
    SELECT COALESCE(SUM(oi.total_amount), 0) INTO service_total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.item_type = 'servicio';
    
    -- Calculate 2% cashback on services
    IF service_total > 0 THEN
      cashback_amount := service_total * 0.02;
      
      -- Add cashback transaction
      INSERT INTO public.reward_transactions (
        client_id, transaction_type, amount, description, order_id, expires_at
      ) VALUES (
        NEW.client_id, 'earned', cashback_amount, 
        'Cashback 2% por orden #' || NEW.order_number,
        NEW.id, now() + INTERVAL '1 year'
      );
      
      -- Update client rewards
      UPDATE public.client_rewards 
      SET total_cashback = total_cashback + cashback_amount,
          updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
    
    -- Mark new client discount as used if it was a new client
    IF client_rewards_record.is_new_client AND NOT client_rewards_record.new_client_discount_used THEN
      UPDATE public.client_rewards 
      SET new_client_discount_used = true, is_new_client = false, updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
    
    -- Check for referral bonus
    SELECT * INTO referral_record 
    FROM public.client_referrals 
    WHERE referred_client_id = NEW.client_id 
    AND referral_bonus_given < 3 
    AND status = 'active';
    
    IF referral_record.id IS NOT NULL THEN
      -- Calculate 5% referral bonus
      referrer_bonus := (NEW.estimated_cost * 0.05);
      
      -- Add referral bonus transaction
      INSERT INTO public.reward_transactions (
        client_id, transaction_type, amount, description, order_id, expires_at
      ) VALUES (
        referral_record.referrer_client_id, 'referral_bonus', referrer_bonus,
        'Bono por referido - Orden #' || NEW.order_number,
        NEW.id, now() + INTERVAL '1 year'
      );
      
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
    
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clean_expired_rewards()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  -- Mark expired transactions
  UPDATE public.reward_transactions 
  SET transaction_type = 'expired'
  WHERE expires_at < now() 
  AND transaction_type IN ('earned', 'referral_bonus');
  
  -- Recalculate total cashback for affected clients
  UPDATE public.client_rewards 
  SET total_cashback = (
    SELECT COALESCE(SUM(rt.amount), 0)
    FROM public.reward_transactions rt
    WHERE rt.client_id = client_rewards.client_id
    AND rt.transaction_type IN ('earned', 'referral_bonus')
    AND (rt.expires_at IS NULL OR rt.expires_at > now())
  ),
  updated_at = now()
  WHERE client_id IN (
    SELECT DISTINCT client_id 
    FROM public.reward_transactions 
    WHERE transaction_type = 'expired'
  );
END;
$$;