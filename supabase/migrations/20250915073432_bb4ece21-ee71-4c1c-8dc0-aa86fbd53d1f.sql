-- Corregir función calculate_order_total para que coincida exactamente con frontend
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
  item_total NUMERIC;
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
  
  -- Determinar si es cliente nuevo
  SELECT COUNT(*) = 0 INTO is_new_client
  FROM public.orders
  WHERE client_id = order_rec.client_id
    AND status = 'finalizada'
    AND created_at < order_rec.created_at;
  
  -- Calcular cashback a aplicar
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := CASE 
      WHEN is_new_client THEN rs.new_client_cashback_percent 
      ELSE rs.general_cashback_percent 
    END;
  END IF;
  
  -- DEBUG: Log de parámetros
  RAISE LOG 'Calculando precio para orden %: cashback_rate=%, is_new_client=%', p_order_id, cashback_rate, is_new_client;
  
  -- Calcular total usando EXACTAMENTE la misma lógica que frontend
  FOR item_rec IN 
    SELECT oi.*, st.base_price, st.cost_price, st.profit_margin_tiers, st.item_type as service_item_type
    FROM public.order_items oi
    LEFT JOIN public.service_types st ON st.id = oi.service_type_id
    WHERE oi.order_id = p_order_id
  LOOP
    -- Determinar si es producto
    DECLARE
      is_product BOOLEAN := false;
    BEGIN
      IF item_rec.service_item_type = 'articulo' OR item_rec.profit_margin_tiers IS NOT NULL THEN
        is_product := true;
      END IF;
      
      IF is_product THEN
        -- ARTÍCULOS: costo + margen + IVA compra + IVA venta + cashback
        applicable_margin := 30.0;
        
        -- Calcular margen aplicable basado en quantity tiers
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
        
        -- Para artículos: cost * (1 + purchase_vat) * (1 + margin) * (1 + sales_vat) * (1 + cashback)
        base_price := COALESCE(item_rec.cost_price, item_rec.unit_cost_price, 0);
        base_price := base_price * (1 + 16.0 / 100.0); -- IVA compra
        base_price := base_price * (1 + applicable_margin / 100.0); -- Margen
        after_vat := base_price * (1 + sales_vat_rate / 100.0); -- IVA venta
        final_price := after_vat * (1 + cashback_rate / 100.0); -- Cashback
        
      ELSE
        -- SERVICIOS: precio base + IVA + cashback (EXACTAMENTE como frontend)
        -- Los logs muestran: base=500, afterVAT=580, final=591.6
        base_price := COALESCE(item_rec.base_price, item_rec.unit_base_price, 500);
        after_vat := base_price * (1 + sales_vat_rate / 100.0);  -- 500 * 1.16 = 580
        final_price := after_vat * (1 + cashback_rate / 100.0);   -- 580 * 1.02 = 591.6
        
        -- DEBUG: Log del cálculo
        RAISE LOG 'Servicio %: base=%, afterVAT=%, final=%', item_rec.service_name, base_price, after_vat, final_price;
      END IF;
      
      -- Calcular total por cantidad
      item_total := final_price * item_rec.quantity;
      
      -- Aplicar ceilToTen (redondear hacia arriba a decenas)
      item_total := CEIL(item_total / 10.0) * 10;
      
      -- DEBUG: Log del total final
      RAISE LOG 'Item % total: % (quantity=%, rounded=%)', item_rec.service_name, item_total, item_rec.quantity, item_total;
      
      total_amt := total_amt + item_total;
    END;
  END LOOP;
  
  -- Calcular subtotal y VAT del total final
  subtotal := total_amt / (1 + sales_vat_rate / 100.0);
  vat_amount := total_amt - subtotal;
  total_amount := total_amt;
  
  -- DEBUG: Log final
  RAISE LOG 'Total final orden %: subtotal=%, vat=%, total=%', p_order_id, subtotal, vat_amount, total_amount;
  
  RETURN NEXT;
END;
$function$;