-- Execute the corrected function to update pending collections with proper rounding
DO $$
DECLARE
  order_record RECORD;
  item_record RECORD;
  correct_total NUMERIC := 0;
  item_total NUMERIC;
  is_new_client BOOLEAN;
  cashback_rate NUMERIC := 0;
  reward_settings_record RECORD;
  cost_with_vat NUMERIC;
  cost_with_margin NUMERIC;
  cost_with_sales_vat NUMERIC;
  final_price NUMERIC;
BEGIN
  -- Get active reward settings
  SELECT * INTO reward_settings_record 
  FROM public.reward_settings 
  WHERE is_active = true 
  LIMIT 1;
  
  -- Delete existing pending collections
  DELETE FROM public.pending_collections;
  
  -- Insert orders with status 'finalizada' that haven't been collected yet
  FOR order_record IN 
    SELECT DISTINCT o.id, o.order_number, o.client_id, c.name as client_name, c.email as client_email
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    WHERE o.status = 'finalizada'
      AND NOT EXISTS (
        SELECT 1 FROM public.incomes i 
        WHERE i.description LIKE '%' || o.order_number || '%' 
        AND i.income_type = 'orden'
      )
  LOOP
    correct_total := 0;
    
    -- Check if client is new (no completed orders before this one)
    SELECT COUNT(*) = 0 INTO is_new_client
    FROM public.orders 
    WHERE client_id = order_record.client_id 
      AND status = 'finalizada' 
      AND created_at < (SELECT created_at FROM public.orders WHERE id = order_record.id);
    
    -- Determine cashback rate
    IF reward_settings_record.apply_cashback_to_items AND reward_settings_record IS NOT NULL THEN
      cashback_rate := CASE 
        WHEN is_new_client THEN reward_settings_record.new_client_cashback_percent 
        ELSE reward_settings_record.general_cashback_percent 
      END;
    ELSE
      cashback_rate := 0;
    END IF;
    
    RAISE LOG 'Order %, Client new: %, Cashback rate: %', order_record.order_number, is_new_client, cashback_rate;
    
    -- Calculate correct total for each order item
    FOR item_record IN 
      SELECT * FROM public.order_items 
      WHERE order_id = order_record.id
    LOOP
      IF item_record.item_type = 'servicio' THEN
        -- Services: base_price + VAT + cashback, then round each item
        item_total := item_record.unit_base_price * item_record.quantity;
        item_total := item_total * (1 + COALESCE(item_record.vat_rate, 0) / 100.0);
        item_total := item_total * (1 + cashback_rate / 100.0);
        
        -- Round each item individually up to nearest 10
        item_total := CEIL(item_total / 10.0) * 10;
        
        RAISE LOG 'Service item: % -> final: %', item_record.service_name, item_total;
        
      ELSE
        -- Products: cost + purchase VAT + margin + sales VAT + cashback, then round each item
        cost_with_vat := item_record.unit_cost_price * (1 + COALESCE(item_record.vat_rate, 0) / 100.0);
        cost_with_margin := cost_with_vat * (1 + COALESCE(item_record.profit_margin_rate, 0) / 100.0);
        cost_with_sales_vat := cost_with_margin * (1 + COALESCE(item_record.vat_rate, 0) / 100.0);
        final_price := cost_with_sales_vat * (1 + cashback_rate / 100.0);
        
        item_total := final_price * item_record.quantity;
        
        -- Round each item individually up to nearest 10
        item_total := CEIL(item_total / 10.0) * 10;
        
        RAISE LOG 'Product item: % -> cost: %, vat1: %, margin: %, vat2: %, cashback: %, final: %', 
          item_record.service_name, item_record.unit_cost_price, cost_with_vat, cost_with_margin, 
          cost_with_sales_vat, final_price, item_total;
      END IF;
      
      correct_total := correct_total + item_total;
    END LOOP;
    
    RAISE LOG 'Final total for order %: %', order_record.order_number, correct_total;
    
    -- Insert into pending collections with the correctly calculated total
    INSERT INTO public.pending_collections (
      order_id, order_number, client_name, client_email, amount, balance
    ) VALUES (
      order_record.id, order_record.order_number, 
      order_record.client_name, order_record.client_email,
      correct_total, correct_total
    );
  END LOOP;
END $$;