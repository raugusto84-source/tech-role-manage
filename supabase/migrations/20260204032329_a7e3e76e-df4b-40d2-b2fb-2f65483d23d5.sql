-- Fix convert_quote_to_order to properly transfer pricing from quote_items to order_items
-- The issue: unit_cost_price, unit_base_price, profit_margin_rate, and item_type were not being properly transferred

CREATE OR REPLACE FUNCTION public.convert_quote_to_order(quote_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  quote_record RECORD;
  client_record RECORD;
  order_record RECORD;
  service_type_record uuid;
  existing_order RECORD;
  new_estimated_delivery TIMESTAMP WITH TIME ZONE;
  total_items_count INTEGER;
  original_items_total NUMERIC := 0;
  discount_factor NUMERIC := 1;
  new_order_number TEXT;
  attempt INTEGER := 0;
  max_attempts INTEGER := 5;
BEGIN
  -- Obtener la cotización
  SELECT * INTO quote_record
  FROM public.quotes q
  WHERE q.id = convert_quote_to_order.quote_id;
  
  IF quote_record.id IS NULL THEN
    RETURN json_build_object('error', 'Cotización no encontrada');
  END IF;

  -- Verificar que la cotización no esté ya aceptada
  IF quote_record.status = 'aceptada' THEN
    SELECT o.* INTO existing_order
    FROM public.orders o
    WHERE o.quote_id = convert_quote_to_order.quote_id
    ORDER BY o.created_at DESC
    LIMIT 1;
    
    IF existing_order.id IS NOT NULL THEN
      RETURN json_build_object(
        'success', true,
        'existing', true,
        'order_id', existing_order.id,
        'order_number', existing_order.order_number,
        'total_amount', quote_record.estimated_amount,
        'message', 'Ya existe una orden para esta cotización'
      );
    ELSE
      RETURN json_build_object('error', 'Esta cotización ya ha sido aceptada anteriormente');
    END IF;
  END IF;
  
  -- Obtener o crear cliente
  SELECT * INTO client_record
  FROM public.clients c
  WHERE c.email = quote_record.client_email
  LIMIT 1;
  
  IF client_record.id IS NULL THEN
    INSERT INTO public.clients (name, email, phone, address, created_by)
    VALUES (
      quote_record.client_name,
      quote_record.client_email,
      COALESCE(quote_record.client_phone, ''),
      'Dirección no especificada',
      COALESCE(quote_record.assigned_to, auth.uid())
    ) RETURNING * INTO client_record;
  END IF;

  -- Verificar si ya existe orden para este quote_id
  SELECT o.* INTO existing_order
  FROM public.orders o
  WHERE o.quote_id = convert_quote_to_order.quote_id
  ORDER BY o.created_at DESC
  LIMIT 1;
  
  IF existing_order.id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'existing', true,
      'order_id', existing_order.id,
      'order_number', existing_order.order_number,  
      'total_amount', quote_record.estimated_amount,
      'message', 'Ya existe una orden para esta cotización'
    );
  END IF;
  
  -- Verificar que la cotización tenga items
  SELECT COUNT(*) INTO total_items_count
  FROM public.quote_items qi
  WHERE qi.quote_id = convert_quote_to_order.quote_id;
  
  IF total_items_count = 0 THEN
    RETURN json_build_object('error', 'La cotización no tiene items para convertir');
  END IF;

  -- Calcular factor de descuento si hay cashback aplicado
  SELECT COALESCE(SUM(qi.total), 0) INTO original_items_total
  FROM public.quote_items qi
  WHERE qi.quote_id = convert_quote_to_order.quote_id;

  IF quote_record.cashback_applied = true AND COALESCE(quote_record.cashback_amount_used, 0) > 0 THEN
    discount_factor := quote_record.estimated_amount / GREATEST(original_items_total, 1);
  END IF;
  
  -- Obtener un service_type por defecto
  SELECT st.id INTO service_type_record
  FROM public.service_types st
  WHERE st.is_active = true 
  LIMIT 1;
  
  -- Actualizar estado de la cotización a 'aceptada'
  UPDATE public.quotes 
  SET 
    status = 'aceptada',
    final_decision_date = now(),
    updated_at = now()
  WHERE id = quote_record.id AND status != 'aceptada';
  
  -- Generate unique order number with retry loop
  LOOP
    attempt := attempt + 1;
    new_order_number := generate_order_number();
    
    BEGIN
      -- Crear la orden
      INSERT INTO public.orders (
        order_number,
        client_id,
        quote_id,
        service_type,
        failure_description,
        estimated_cost,
        delivery_date,
        created_by,
        status,
        client_approval,
        source_type
      ) VALUES (
        new_order_number,
        client_record.id,
        convert_quote_to_order.quote_id,
        service_type_record,
        quote_record.service_description,
        quote_record.estimated_amount,
        CURRENT_DATE + INTERVAL '7 days',
        COALESCE(quote_record.assigned_to, auth.uid()),
        'en_proceso'::order_status,
        true,
        'quote'
      ) RETURNING * INTO order_record;
      
      EXIT;
      
    EXCEPTION
      WHEN unique_violation THEN
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'No se pudo generar un número de orden único después de % intentos', max_attempts;
        END IF;
    END;
  END LOOP;
  
  -- Crear order_items PRESERVANDO los valores exactos de la cotización
  -- Usar los datos del service_types para cost_price, profit_margin, item_type
  INSERT INTO public.order_items (
    order_id,
    service_type_id,
    service_name,
    service_description,
    quantity,
    unit_cost_price,
    unit_base_price,
    profit_margin_rate,
    subtotal,
    vat_rate,
    vat_amount,
    total_amount,
    item_type,
    status,
    pricing_locked
  ) 
  SELECT 
    order_record.id,
    COALESCE(qi.service_type_id, service_type_record),
    qi.name,
    qi.description,
    qi.quantity,
    -- unit_cost_price: usar cost_price del service_type si existe, sino calcular del unit_price
    COALESCE(st.cost_price, qi.unit_price / GREATEST(qi.quantity, 1)),
    -- unit_base_price: usar base_price del service_type si es servicio, sino calcular
    CASE 
      WHEN COALESCE(st.item_type, 'servicio') = 'servicio' THEN COALESCE(st.base_price, qi.unit_price / GREATEST(qi.quantity, 1))
      ELSE COALESCE(st.cost_price, qi.unit_price / GREATEST(qi.quantity, 1))
    END,
    -- profit_margin_rate: extraer del service_type si existe
    COALESCE(
      (SELECT (tier->>'margin')::numeric FROM jsonb_array_elements(st.profit_margin_tiers::jsonb) AS tier LIMIT 1),
      0
    ),
    -- subtotal: usar el valor exacto de la cotización (ya multiplicado por cantidad)
    qi.subtotal * discount_factor,
    qi.vat_rate,
    -- vat_amount: usar el valor exacto de la cotización
    qi.vat_amount * discount_factor,
    -- total_amount: usar el valor exacto de la cotización (ya incluye VAT y cantidad)
    qi.total * discount_factor,
    -- item_type: usar del service_type o inferir de is_custom
    COALESCE(st.item_type, CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END),
    'pendiente'::order_status,
    true -- Bloquear precios para que no se recalculen
  FROM public.quote_items qi
  LEFT JOIN public.service_types st ON st.id = qi.service_type_id
  WHERE qi.quote_id = convert_quote_to_order.quote_id;
  
  -- Calcular fecha estimada de entrega
  new_estimated_delivery := CURRENT_TIMESTAMP + INTERVAL '7 days';
  
  -- Actualizar orden con fecha estimada
  UPDATE public.orders 
  SET 
    estimated_delivery_date = new_estimated_delivery,
    delivery_date = new_estimated_delivery::date,
    updated_at = now()
  WHERE id = order_record.id;
  
  -- Registrar en historial
  INSERT INTO public.order_status_logs (
    order_id,
    previous_status,
    new_status,
    changed_by,
    notes
  ) VALUES (
    order_record.id,
    NULL,
    'en_proceso'::order_status,
    COALESCE(quote_record.assigned_to, auth.uid()),
    'Orden creada desde cotización ' || quote_record.quote_number || 
    CASE WHEN quote_record.cashback_applied = true 
         THEN ' (con descuento por cashback aplicado)' 
         ELSE '' END
  );
  
  RETURN json_build_object(
    'success', true,
    'order_id', order_record.id,
    'order_number', order_record.order_number,
    'quote_number', quote_record.quote_number,
    'total_amount', quote_record.estimated_amount,
    'estimated_delivery_date', new_estimated_delivery,
    'items_converted', total_items_count,
    'client_name', client_record.name,
    'cashback_applied', COALESCE(quote_record.cashback_applied, false),
    'cashback_amount', COALESCE(quote_record.cashback_amount_used, 0)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', 'Error interno: ' || SQLERRM);
END;
$function$;