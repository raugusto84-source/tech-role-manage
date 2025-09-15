-- Actualizar función calculate_order_total para usar misma lógica que frontend
CREATE OR REPLACE FUNCTION public.calculate_order_total(p_order_id UUID)
RETURNS TABLE(subtotal NUMERIC, vat_amount NUMERIC, total_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_rec RECORD;
  order_rec RECORD;
  rs RECORD;
  service_rec RECORD;
  item_subtotal NUMERIC;
  item_vat NUMERIC;
  item_total NUMERIC;
  total_sub NUMERIC := 0;
  total_vat NUMERIC := 0;
  total_amt NUMERIC := 0;
  is_new_client BOOLEAN := false;
  cashback_rate NUMERIC := 0;
  sales_vat_rate NUMERIC := 16;
  applicable_margin NUMERIC;
  tier_data JSONB;
  base_price NUMERIC;
  after_vat NUMERIC;
  final_price NUMERIC;
BEGIN
  -- Obtener información de la orden
  SELECT * INTO order_rec FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  -- Obtener configuración de rewards activa
  SELECT * INTO rs FROM public.reward_settings WHERE is_active = true LIMIT 1;
  
  -- Determinar si es cliente nuevo (misma lógica que frontend)
  SELECT COUNT(*) = 0 INTO is_new_client
  FROM public.orders
  WHERE client_id = order_rec.client_id
    AND status = 'finalizada'
    AND created_at < order_rec.created_at;
  
  -- Calcular cashback a aplicar (misma lógica que frontend)
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := CASE 
      WHEN is_new_client THEN rs.new_client_cashback_percent 
      ELSE rs.general_cashback_percent 
    END;
  END IF;
  
  -- Calcular total de todos los items usando EXACTAMENTE la misma lógica que useSalesPricingCalculation
  FOR item_rec IN 
    SELECT oi.*, st.base_price, st.cost_price, st.profit_margin_tiers, st.item_type as service_item_type
    FROM public.order_items oi
    LEFT JOIN public.service_types st ON st.id = oi.service_type_id
    WHERE oi.order_id = p_order_id
  LOOP
    -- Determinar si es producto (misma lógica que isProduct en frontend)
    DECLARE
      is_product BOOLEAN := false;
    BEGIN
      IF item_rec.service_item_type = 'articulo' OR item_rec.profit_margin_tiers IS NOT NULL THEN
        is_product := true;
      END IF;
      
      IF is_product THEN
        -- ARTÍCULOS: Lógica exacta del frontend
        applicable_margin := 30.0; -- default margin
        
        -- Calcular margen aplicable basado en quantity tiers (misma lógica que marginFromTiers)
        IF item_rec.profit_margin_tiers IS NOT NULL THEN
          FOR tier_data IN SELECT * FROM jsonb_array_elements(item_rec.profit_margin_tiers)
          LOOP
            IF item_rec.quantity >= (tier_data->>'min_qty')::integer 
               AND item_rec.quantity <= (tier_data->>'max_qty')::integer THEN
              applicable_margin := (tier_data->>'margin')::numeric;
              EXIT;
            END IF;
          END LOOP;
        END IF;
        
        -- Calcular precio final para artículos (exactamente como frontend)
        base_price := COALESCE(item_rec.cost_price, item_rec.unit_cost_price, 0) * (1 + applicable_margin / 100.0);
        after_vat := base_price * (1 + sales_vat_rate / 100.0);
        final_price := after_vat * (1 + cashback_rate / 100.0);
        item_total := final_price * item_rec.quantity;
        
      ELSE
        -- SERVICIOS: Lógica exacta del frontend
        base_price := COALESCE(item_rec.base_price, item_rec.unit_base_price, 0);
        after_vat := base_price * (1 + sales_vat_rate / 100.0);
        final_price := after_vat * (1 + cashback_rate / 100.0);
        item_total := final_price * item_rec.quantity;
      END IF;
      
      -- Aplicar ceilToTen (redondear hacia arriba a decenas)
      item_total := CEIL(item_total / 10.0) * 10;
      
      -- Calcular subtotal y VAT del total redondeado
      item_subtotal := item_total / (1 + sales_vat_rate / 100.0);
      item_vat := item_total - item_subtotal;
      
      total_sub := total_sub + item_subtotal;
      total_vat := total_vat + item_vat;
      total_amt := total_amt + item_total;
    END;
  END LOOP;
  
  subtotal := total_sub;
  vat_amount := total_vat;
  total_amount := total_amt;
  RETURN NEXT;
END;
$function$;

-- Actualizar trigger para ejecutarse DESPUÉS de que todos los items estén procesados
CREATE OR REPLACE FUNCTION public.create_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Solo para INSERT de órdenes, pero ejecutar DESPUÉS en el ciclo de transacción
  IF TG_OP = 'INSERT' THEN
    -- Usar pg_notify para ejecutar el cálculo después de que la transacción se complete
    PERFORM pg_notify('calculate_order_total', NEW.id::text);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Función para manejar la notificación y calcular totales
CREATE OR REPLACE FUNCTION public.handle_calculate_order_total()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  calc_totals RECORD;
  order_id_param UUID;
BEGIN
  -- Esta función será llamada por el listener de notificaciones
  -- Por ahora, recalcular todos los totales pendientes
  FOR order_id_param IN 
    SELECT o.id FROM public.orders o
    LEFT JOIN public.order_totals ot ON ot.order_id = o.id
    WHERE ot.id IS NULL
    AND EXISTS (SELECT 1 FROM public.order_items WHERE order_id = o.id)
  LOOP
    SELECT * INTO calc_totals FROM public.calculate_order_total(order_id_param);
    
    IF FOUND THEN
      INSERT INTO public.order_totals (
        order_id, 
        subtotal, 
        vat_amount, 
        total_amount,
        calculated_at
      ) VALUES (
        order_id_param,
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
    END IF;
  END LOOP;
END;
$function$;

-- Trigger mejorado para recalcular cuando se modifican items
CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  calc_totals RECORD;
  target_order_id UUID;
BEGIN
  -- Determinar el order_id según la operación
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD.order_id;
  ELSE
    target_order_id := NEW.order_id;
  END IF;
  
  -- Esperar un poco para que se complete cualquier otra inserción en la misma transacción
  PERFORM pg_sleep(0.05);
  
  -- Calcular nuevos totales
  SELECT * INTO calc_totals FROM public.calculate_order_total(target_order_id);
  
  IF FOUND THEN
    -- Actualizar o insertar totales
    INSERT INTO public.order_totals (
      order_id, 
      subtotal, 
      vat_amount, 
      total_amount,
      calculated_at
    ) VALUES (
      target_order_id,
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
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;