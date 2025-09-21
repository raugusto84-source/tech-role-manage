-- Fix cashback system: Create trigger and initialize client rewards
BEGIN;

-- 1. Create the trigger for processing cashback
CREATE TRIGGER IF NOT EXISTS process_order_cashback
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'finalizada' AND OLD.status != 'finalizada')
  EXECUTE FUNCTION public.process_order_cashback();

-- 2. Initialize client_rewards records for existing clients
INSERT INTO public.client_rewards (client_id, total_cashback, is_new_client, new_client_discount_used)
SELECT 
  c.id,
  0,
  true,
  false
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_rewards cr WHERE cr.client_id = c.id
)
ON CONFLICT (client_id) DO NOTHING;

-- 3. Process cashback for existing completed orders
DO $$
DECLARE
  completed_order RECORD;
  client_reward_record RECORD;
  cashback_settings RECORD;
  order_total NUMERIC;
  cashback_amount NUMERIC;
  cashback_rate NUMERIC;
BEGIN
  -- Get current reward settings
  SELECT * INTO cashback_settings
  FROM public.reward_settings 
  WHERE is_active = true 
  ORDER BY COALESCE(updated_at, created_at) DESC 
  LIMIT 1;
  
  -- Process each completed order that doesn't have cashback yet
  FOR completed_order IN 
    SELECT DISTINCT o.id, o.client_id, o.estimated_cost
    FROM public.orders o
    WHERE o.status = 'finalizada'
      AND NOT EXISTS (
        SELECT 1 FROM public.reward_transactions rt 
        WHERE rt.client_id = o.client_id 
          AND rt.related_order_id = o.id 
          AND rt.transaction_type = 'cashback_earned'
      )
  LOOP
    -- Get client rewards record
    SELECT * INTO client_reward_record
    FROM public.client_rewards
    WHERE client_id = completed_order.client_id;
    
    IF client_reward_record IS NOT NULL THEN
      -- Calculate cashback amount
      order_total := COALESCE(completed_order.estimated_cost, 0);
      
      -- Determine cashback rate
      IF cashback_settings IS NOT NULL THEN
        IF client_reward_record.is_new_client AND NOT client_reward_record.new_client_discount_used THEN
          cashback_rate := COALESCE(cashback_settings.new_client_cashback_percent, 2.0);
          -- Mark new client discount as used
          UPDATE public.client_rewards 
          SET new_client_discount_used = true
          WHERE client_id = completed_order.client_id;
        ELSE
          cashback_rate := COALESCE(cashback_settings.general_cashback_percent, 2.0);
        END IF;
      ELSE
        cashback_rate := 2.0; -- Default 2%
      END IF;
      
      cashback_amount := order_total * (cashback_rate / 100.0);
      
      -- Only process if cashback amount is positive
      IF cashback_amount > 0 THEN
        -- Update total cashback
        UPDATE public.client_rewards
        SET 
          total_cashback = COALESCE(total_cashback, 0) + cashback_amount,
          updated_at = now()
        WHERE client_id = completed_order.client_id;
        
        -- Create transaction record
        INSERT INTO public.reward_transactions (
          client_id,
          transaction_type,
          amount,
          description,
          related_order_id,
          expires_at
        ) VALUES (
          completed_order.client_id,
          'cashback_earned',
          cashback_amount,
          'Cashback por orden completada (' || cashback_rate || '%)',
          completed_order.id,
          CURRENT_DATE + INTERVAL '1 year'
        );
        
        RAISE LOG 'Processed cashback for order % - Amount: %', completed_order.id, cashback_amount;
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;