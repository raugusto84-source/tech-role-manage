-- Fix security warning: Add proper search_path to the cashback function
CREATE OR REPLACE FUNCTION public.calculate_cashback_on_full_payment()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
  order_record RECORD;
  total_paid NUMERIC := 0;
  cashback_amount NUMERIC := 0;
  reward_settings RECORD;
  existing_cashback RECORD;
BEGIN
  -- Get the order details
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = NEW.order_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Calculate total payments for this order
  SELECT COALESCE(SUM(payment_amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;
  
  -- Check if order is fully paid (total paid >= estimated cost)
  IF total_paid < COALESCE(order_record.estimated_cost, 0) THEN
    RAISE LOG 'Order % not fully paid yet. Paid: %, Required: %', 
      order_record.order_number, total_paid, order_record.estimated_cost;
    RETURN NEW;
  END IF;
  
  -- Check if cashback already exists for this order
  SELECT * INTO existing_cashback
  FROM public.client_reward_transactions
  WHERE order_id = NEW.order_id
    AND transaction_type = 'earned'
    AND description LIKE '%Cashback por orden%';
  
  IF FOUND THEN
    RAISE LOG 'Cashback already processed for order %', order_record.order_number;
    RETURN NEW;
  END IF;
  
  -- Get active reward settings
  SELECT * INTO reward_settings
  FROM public.reward_settings
  WHERE is_active = true
  ORDER BY COALESCE(updated_at, created_at) DESC
  LIMIT 1;
  
  IF NOT FOUND OR NOT reward_settings.apply_cashback_to_items THEN
    RAISE LOG 'No active reward settings found or cashback not enabled';
    RETURN NEW;
  END IF;
  
  -- Calculate cashback based on order estimated cost
  cashback_amount := COALESCE(order_record.estimated_cost, 0) * 
                    COALESCE(reward_settings.general_cashback_percent, 0) / 100.0;
  
  IF cashback_amount > 0 THEN
    -- Insert cashback transaction
    INSERT INTO public.client_reward_transactions (
      client_id,
      transaction_type,
      amount,
      description,
      order_id,
      created_by
    ) VALUES (
      order_record.client_id,
      'earned',
      cashback_amount,
      'Cashback por orden ' || order_record.order_number || ' completamente pagada',
      NEW.order_id,
      COALESCE(NEW.created_by, auth.uid())
    );
    
    -- Update client total cashback
    UPDATE public.client_rewards
    SET total_cashback = total_cashback + cashback_amount,
        updated_at = now()
    WHERE client_id = order_record.client_id;
    
    RAISE LOG 'Cashback of % applied for fully paid order %', 
      cashback_amount, order_record.order_number;
  END IF;
  
  RETURN NEW;
END;
$$;