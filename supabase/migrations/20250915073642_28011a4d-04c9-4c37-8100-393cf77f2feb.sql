-- Fix calculate_order_total function to match frontend logic exactly
CREATE OR REPLACE FUNCTION public.calculate_order_total(p_order_id uuid)
RETURNS TABLE(subtotal numeric, vat_amount numeric, total_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_rec RECORD;
  total_subtotal NUMERIC := 0;
  total_vat NUMERIC := 0;
  final_total NUMERIC := 0;
  reward_settings_rec RECORD;
  is_new_client BOOLEAN := false;
BEGIN
  -- Get reward settings
  SELECT * INTO reward_settings_rec 
  FROM public.reward_settings 
  WHERE is_active = true 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Check if client is new (for cashback calculation)
  IF reward_settings_rec.apply_cashback_to_items THEN
    SELECT cr.is_new_client INTO is_new_client
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.client_rewards cr ON cr.client_id = c.id
    WHERE o.id = p_order_id;
  END IF;
  
  -- Calculate for each order item using EXACT frontend logic
  FOR item_rec IN 
    SELECT oi.*, st.item_type as service_item_type
    FROM public.order_items oi
    LEFT JOIN public.service_types st ON st.id = oi.service_type_id
    WHERE oi.order_id = p_order_id
  LOOP
    DECLARE
      item_subtotal NUMERIC;
      item_vat NUMERIC;
      item_total NUMERIC;
      cashback_rate NUMERIC := 0;
    BEGIN
      -- Determine cashback rate
      IF reward_settings_rec.apply_cashback_to_items AND is_new_client THEN
        cashback_rate := reward_settings_rec.new_client_cashback_percent;
      ELSIF reward_settings_rec.apply_cashback_to_items THEN
        cashback_rate := reward_settings_rec.general_cashback_percent;
      END IF;
      
      -- EXACT frontend logic reproduction:
      -- 1. Start with base subtotal and VAT from order_items (already calculated correctly)
      item_subtotal := item_rec.subtotal; -- 500
      item_vat := item_rec.vat_amount;     -- 80 (16% of 500)
      
      -- 2. Calculate total before cashback
      item_total := item_subtotal + item_vat; -- 580
      
      -- 3. Apply cashback if enabled (multiply total by cashback factor)
      IF cashback_rate > 0 THEN
        item_total := item_total * (1 + cashback_rate / 100); -- 580 * 1.02 = 591.6
      END IF;
      
      -- 4. Apply ceiling to next 10 (ceilToTen function)
      item_total := CEIL(item_total / 10.0) * 10; -- ceilToTen(591.6) = 600
      
      -- 5. Back-calculate subtotal and VAT for the final total
      -- If cashback was applied, we need to adjust the split
      IF cashback_rate > 0 THEN
        -- Total is 600, we need to split this back to subtotal + VAT maintaining 16% VAT rate
        item_subtotal := item_total / 1.16; -- 600 / 1.16 = 517.24
        item_vat := item_total - item_subtotal; -- 600 - 517.24 = 82.76
      END IF;
      
      -- Add to totals
      total_subtotal := total_subtotal + item_subtotal;
      total_vat := total_vat + item_vat;
    END;
  END LOOP;
  
  final_total := total_subtotal + total_vat;
  
  RAISE LOG 'Order % total calculation: subtotal=%, vat=%, total=%', 
    p_order_id, total_subtotal, total_vat, final_total;
  
  RETURN QUERY SELECT total_subtotal, total_vat, final_total;
END;
$$;

-- Recalculate all existing orders with the fixed function
DO $$
DECLARE
  order_rec RECORD;
  calc_totals RECORD;
BEGIN
  FOR order_rec IN 
    SELECT DISTINCT o.id 
    FROM public.orders o
    WHERE EXISTS (SELECT 1 FROM public.order_items WHERE order_id = o.id)
  LOOP
    SELECT * INTO calc_totals FROM public.calculate_order_total(order_rec.id);
    
    IF FOUND THEN
      INSERT INTO public.order_totals (
        order_id, 
        subtotal, 
        vat_amount, 
        total_amount,
        calculated_at
      ) VALUES (
        order_rec.id,
        calc_totals.subtotal,
        calc_totals.vat_amount,
        calc_totals.total_amount,
        now()
      )
      ON CONFLICT (order_id) DO UPDATE SET
        subtotal = EXCLUDED.subtotal,
        vat_amount = EXCLUDED.vat_amount,
        total_amount = EXCLUDED.total_amount,
        calculated_at = now(),
        updated_at = now();
        
      RAISE LOG 'Fixed total for order %: %', order_rec.id, calc_totals.total_amount;
    END IF;
  END LOOP;
  
  -- Refresh collections with correct totals
  PERFORM public.refresh_pending_collections();
  
  RAISE LOG 'Order totals fixed - should now show 600 for ORD-2025-0001';
END;
$$;