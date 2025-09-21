-- Update convert_quote_to_order to persist cashback fields into orders
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
BEGIN
  -- Verificar permisos
  IF get_user_role_safe() NOT IN ('administrador', 'vendedor', 'cliente') THEN
    RETURN json_build_object('error', 'No tiene permisos para convertir cotizaciones');
  END IF;

  -- Obtener la cotización usando el parámetro de la función
  SELECT * INTO quote_record
  FROM public.quotes q
  WHERE q.id = convert_quote_to_order.quote_id;
  
  IF quote_record.id IS NULL THEN
    RETURN json_build_object('error', 'Cotización no encontrada');
  END IF;

  -- VERIFICACIÓN MEJORADA: Verificar que la cotización no esté ya aceptada
  IF quote_record.status = 'aceptada' THEN
    -- Buscar si ya existe una orden para esta cotización específica
    SELECT o.* INTO existing_order
    FROM public.orders o
    WHERE EXISTS (
      SELECT 1 FROM public.order_status_logs osl 
      WHERE osl.order_id = o.id 
      AND osl.notes LIKE '%cotización ' || quote_record.quote_number || '%'
    )
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

  -- VERIFICACIÓN MEJORADA: Buscar órdenes duplicadas más específicamente
  SELECT o.* INTO existing_order
  FROM public.orders o
  WHERE o.client_id = client_record.id
    AND EXISTS (
      SELECT 1 FROM public.order_status_logs osl 
      WHERE osl.order_id = o.id 
      AND osl.notes LIKE '%cotización ' || quote_record.quote_number || '%'
    )
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
  
  -- Obtener un service_type por defecto (solo el ID)
  SELECT st.id INTO service_type_record
  FROM public.service_types st
  WHERE st.is_active = true 
  LIMIT 1;
  
  -- Actualizar estado de la cotización a 'aceptada' SOLO SI NO ESTÁ YA ACEPTADA
  UPDATE public.quotes 
  SET 
    status = 'aceptada',
    final_decision_date = now(),
    updated_at = now()
  WHERE id = quote_record.id AND status != 'aceptada';
  
  -- Crear la orden con el total de la cotización Y copiando campos de cashback
  INSERT INTO public.orders (
    client_id,
    service_type,
    failure_description,
    estimated_cost,
    delivery_date,
    created_by,
    status,
    client_approval,
    cashback_applied,
    cashback_amount_used
  ) VALUES (
    client_record.id,
    service_type_record,
    quote_record.service_description,
    quote_record.estimated_amount,
    CURRENT_DATE + INTERVAL '7 days',
    COALESCE(quote_record.assigned_to, auth.uid()),
    'pendiente_aprobacion'::order_status,
    true,
    COALESCE(quote_record.cashback_applied, false),
    COALESCE(quote_record.cashback_amount_used, 0)
  ) RETURNING * INTO order_record;
  
  -- Crear order_items ajustando precios proporcionalmente si hay cashback aplicado
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
    (qi.subtotal * discount_factor / GREATEST(qi.quantity, 1)),
    (qi.subtotal * discount_factor / GREATEST(qi.quantity, 1)),
    0,
    qi.subtotal * discount_factor,
    qi.vat_rate,
    qi.vat_amount * discount_factor,
    qi.total * discount_factor,
    CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END,
    'pendiente'::order_status,
    true
  FROM public.quote_items qi
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
    'pendiente_aprobacion'::order_status,
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
$function$