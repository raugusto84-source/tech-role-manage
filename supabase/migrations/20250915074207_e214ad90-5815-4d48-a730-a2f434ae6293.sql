-- Simplificar calculate_order_total para guardar el Total General directamente
CREATE OR REPLACE FUNCTION public.calculate_order_total(p_order_id uuid)
RETURNS TABLE(subtotal numeric, vat_amount numeric, total_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_rec RECORD;
  general_total NUMERIC := 0;
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
    SELECT COALESCE(cr.is_new_client, true) INTO is_new_client
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.client_rewards cr ON cr.client_id = c.id
    WHERE o.id = p_order_id;
  END IF;
  
  -- Calculate Total General exactly like frontend: sum of each item rounded to 10
  FOR item_rec IN 
    SELECT oi.*, st.item_type as service_item_type
    FROM public.order_items oi
    LEFT JOIN public.service_types st ON st.id = oi.service_type_id
    WHERE oi.order_id = p_order_id
  LOOP
    DECLARE
      item_display_price NUMERIC;
      cashback_rate NUMERIC := 0;
      profit_margin NUMERIC := 30; -- Default margin for products
    BEGIN
      -- Determine cashback rate
      IF reward_settings_rec.apply_cashback_to_items AND is_new_client THEN
        cashback_rate := reward_settings_rec.new_client_cashback_percent;
      ELSIF reward_settings_rec.apply_cashback_to_items THEN
        cashback_rate := reward_settings_rec.general_cashback_percent;
      END IF;
      
      -- Calculate display price per item using EXACT frontend logic
      IF COALESCE(item_rec.item_type, 'servicio') = 'servicio' THEN
        -- Services: base_price * (1 + VAT) * (1 + cashback)
        item_display_price := item_rec.unit_base_price * (1 + item_rec.vat_rate / 100);
        IF cashback_rate > 0 THEN
          item_display_price := item_display_price * (1 + cashback_rate / 100);
        END IF;
      ELSE
        -- Products: (cost + margin) * (1 + VAT) * (1 + cashback) 
        item_display_price := (item_rec.unit_cost_price * (1 + profit_margin / 100)) * (1 + item_rec.vat_rate / 100);
        IF cashback_rate > 0 THEN
          item_display_price := item_display_price * (1 + cashback_rate / 100);
        END IF;
      END IF;
      
      -- Apply quantity
      item_display_price := item_display_price * item_rec.quantity;
      
      -- Apply ceilToTen to EACH item (like frontend) and add to general total
      general_total := general_total + CEIL(item_display_price / 10.0) * 10;
    END;
  END LOOP;
  
  -- If no items, use estimated_cost as fallback
  IF general_total = 0 THEN
    SELECT COALESCE(o.estimated_cost, 0) INTO general_total
    FROM public.orders o WHERE o.id = p_order_id;
    
    IF general_total > 0 THEN
      -- Apply default VAT and round to 10
      general_total := CEIL((general_total * 1.16) / 10.0) * 10;
    END IF;
  END IF;
  
  -- For simplicity: store the general_total as total_amount
  -- Split back into subtotal + VAT for accounting purposes (using 16% VAT rate)
  DECLARE
    calc_subtotal NUMERIC := general_total / 1.16;
    calc_vat NUMERIC := general_total - (general_total / 1.16);
  BEGIN
    RAISE LOG 'Order % Total General: %', p_order_id, general_total;
    RETURN QUERY SELECT calc_subtotal, calc_vat, general_total;
  END;
END;
$$;

-- Simplify refresh_pending_collections to use stored totals directly
CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_rec RECORD;
  stored_total NUMERIC;
BEGIN
  -- Clear existing pending collections
  DELETE FROM public.pending_collections;
  
  -- Add collections for finalized orders using stored totals
  FOR order_rec IN 
    SELECT o.id, o.order_number, c.name as client_name, c.email as client_email
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    WHERE o.status = 'finalizada'
  LOOP
    -- Use stored total from order_totals, fallback to calculation if needed
    SELECT ot.total_amount INTO stored_total
    FROM public.order_totals ot
    WHERE ot.order_id = order_rec.id;
    
    -- If no stored total, calculate it once and store it
    IF stored_total IS NULL THEN
      DECLARE calc_totals RECORD;
      BEGIN
        SELECT * INTO calc_totals FROM public.calculate_order_total(order_rec.id);
        stored_total := calc_totals.total_amount;
        
        -- Store for future use
        INSERT INTO public.order_totals (order_id, subtotal, vat_amount, total_amount, calculated_at)
        VALUES (order_rec.id, calc_totals.subtotal, calc_totals.vat_amount, calc_totals.total_amount, now())
        ON CONFLICT (order_id) DO UPDATE SET
          subtotal = EXCLUDED.subtotal,
          vat_amount = EXCLUDED.vat_amount,
          total_amount = EXCLUDED.total_amount,
          calculated_at = now(),
          updated_at = now();
      END;
    END IF;
    
    -- Insert pending collection using stored total
    INSERT INTO public.pending_collections (
      order_id, 
      order_number, 
      client_name, 
      client_email, 
      amount
    ) VALUES (
      order_rec.id,
      order_rec.order_number,
      order_rec.client_name,
      order_rec.client_email,
      COALESCE(stored_total, 0)
    );
  END LOOP;
  
  RAISE LOG 'Pending collections refreshed using stored totals';
END;
$$;

-- Auto-calculate and store Total General when order status changes to finalizada
CREATE OR REPLACE FUNCTION public.store_order_total_on_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  calc_totals RECORD;
BEGIN
  -- When order becomes finalizada, calculate and store the Total General
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    SELECT * INTO calc_totals FROM public.calculate_order_total(NEW.id);
    
    INSERT INTO public.order_totals (order_id, subtotal, vat_amount, total_amount, calculated_at)
    VALUES (NEW.id, calc_totals.subtotal, calc_totals.vat_amount, calc_totals.total_amount, now())
    ON CONFLICT (order_id) DO UPDATE SET
      subtotal = EXCLUDED.subtotal,
      vat_amount = EXCLUDED.vat_amount,
      total_amount = EXCLUDED.total_amount,
      calculated_at = now(),
      updated_at = now();
      
    RAISE LOG 'Stored Total General % for order %', calc_totals.total_amount, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-store totals when orders are finalized
DROP TRIGGER IF EXISTS store_total_on_order_finalize ON public.orders;
CREATE TRIGGER store_total_on_order_finalize
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.store_order_total_on_finalize();

-- Recalculate existing orders with the new simplified logic
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
      INSERT INTO public.order_totals (order_id, subtotal, vat_amount, total_amount, calculated_at)
      VALUES (order_rec.id, calc_totals.subtotal, calc_totals.vat_amount, calc_totals.total_amount, now())
      ON CONFLICT (order_id) DO UPDATE SET
        subtotal = EXCLUDED.subtotal,
        vat_amount = EXCLUDED.vat_amount,
        total_amount = EXCLUDED.total_amount,
        calculated_at = now(),
        updated_at = now();
        
      RAISE LOG 'Stored Total General % for order %', calc_totals.total_amount, order_rec.id;
    END IF;
  END LOOP;
  
  -- Refresh collections with stored totals
  PERFORM public.refresh_pending_collections();
  
  RAISE LOG 'All orders now use stored Total General';
END;
$$;