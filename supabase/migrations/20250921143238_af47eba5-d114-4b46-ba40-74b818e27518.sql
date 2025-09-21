-- Fix the trigger that's trying to access non-existent client_reward_transactions table
-- It should use reward_transactions instead

-- First, let's see what triggers exist on order_payments
\d+ order_payments;

-- Drop and recreate the cashback trigger with correct table reference
DROP TRIGGER IF EXISTS calculate_cashback_on_full_payment_trigger ON public.order_payments;

-- Create the corrected trigger function
CREATE OR REPLACE FUNCTION public.calculate_cashback_on_full_payment()
RETURNS TRIGGER AS $$
DECLARE
  order_record RECORD;
  client_record RECORD;
  reward_settings RECORD;
  cashback_percentage NUMERIC := 0;
  cashback_amount NUMERIC := 0;
  payment_total NUMERIC := 0;
BEGIN
  -- Get order details
  SELECT * INTO order_record 
  FROM public.orders 
  WHERE id = NEW.order_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get client details
  SELECT * INTO client_record 
  FROM public.clients 
  WHERE id = order_record.client_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check if order is now fully paid
  SELECT COALESCE(SUM(payment_amount), 0) INTO payment_total
  FROM public.order_payments 
  WHERE order_id = NEW.order_id;
  
  -- Only proceed if order is fully paid
  IF payment_total >= order_record.estimated_cost THEN
    -- Get active reward settings
    SELECT * INTO reward_settings
    FROM public.reward_settings 
    WHERE is_active = true 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF FOUND THEN
      -- Get client reward status
      INSERT INTO public.client_rewards (client_id, is_new_client)
      VALUES (client_record.id, true)
      ON CONFLICT (client_id) DO NOTHING;
      
      -- Determine cashback rate
      SELECT CASE 
        WHEN cr.is_new_client AND NOT cr.new_client_discount_used 
        THEN reward_settings.new_client_cashback_percent
        ELSE reward_settings.general_cashback_percent
      END INTO cashback_percentage
      FROM public.client_rewards cr
      WHERE cr.client_id = client_record.id;
      
      -- Calculate cashback
      cashback_amount := order_record.estimated_cost * (cashback_percentage / 100.0);
      
      IF cashback_amount > 0 THEN
        -- Insert cashback transaction using correct table name
        INSERT INTO public.reward_transactions (
          client_id,
          order_id,
          transaction_type,
          amount,
          description,
          created_at
        ) VALUES (
          client_record.id,
          order_record.id,
          'earned',
          cashback_amount,
          'Cashback por orden ' || order_record.order_number,
          NOW()
        );
        
        -- Update client rewards total
        UPDATE public.client_rewards 
        SET 
          total_cashback = total_cashback + cashback_amount,
          new_client_discount_used = CASE 
            WHEN is_new_client AND NOT new_client_discount_used 
            THEN true 
            ELSE new_client_discount_used 
          END,
          updated_at = NOW()
        WHERE client_id = client_record.id;
        
        RAISE LOG 'Cashback applied: % for order % (client: %)', 
          cashback_amount, order_record.order_number, client_record.name;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER calculate_cashback_on_full_payment_trigger
  AFTER INSERT ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_cashback_on_full_payment();