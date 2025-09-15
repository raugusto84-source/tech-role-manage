-- Corregir función convert_quote_to_order - eliminar ambigüedades
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(quote_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  quote_record RECORD;
  client_record RECORD;
  order_record RECORD;
  service_type_record uuid;
  existing_order RECORD;
  new_estimated_delivery TIMESTAMP WITH TIME ZONE;
  total_items_count INTEGER;
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

  -- Verificar que la cotización no esté ya aceptada
  IF quote_record.status = 'aceptada' THEN
    RETURN json_build_object('error', 'Esta cotización ya ha sido aceptada anteriormente');
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

  -- Verificar que no existe una orden idéntica
  SELECT o.* INTO existing_order
  FROM public.orders o
  WHERE o.client_id = client_record.id
    AND COALESCE(o.failure_description, '') = COALESCE(quote_record.service_description, '')
    AND ABS(COALESCE(o.estimated_cost, 0) - COALESCE(quote_record.estimated_amount, 0)) < 1.00
    AND o.created_at > (quote_record.created_at - INTERVAL '1 hour')
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
  
  -- Obtener un service_type por defecto (solo el ID)
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
  WHERE id = quote_record.id;
  
  -- Crear la orden con el total de la cotización
  INSERT INTO public.orders (
    client_id,
    service_type,
    failure_description,
    estimated_cost,
    delivery_date,
    created_by,
    status,
    client_approval
  ) VALUES (
    client_record.id,
    service_type_record,
    quote_record.service_description,
    quote_record.estimated_amount, -- Total exacto de la cotización
    CURRENT_DATE + INTERVAL '7 days',
    COALESCE(quote_record.assigned_to, auth.uid()),
    'pendiente_aprobacion'::order_status,
    true -- Pre-aprobada porque viene de cotización aceptada
  ) RETURNING * INTO order_record;
  
  -- Crear order_items preservando exactamente los totales de quote_items
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
    COALESCE(qi.service_type_id, service_type_record), -- Usar service_type por defecto si no hay
    qi.name,
    qi.description,
    qi.quantity,
    -- Calcular precios unitarios basados en el subtotal
    (qi.subtotal / GREATEST(qi.quantity, 1)),
    (qi.subtotal / GREATEST(qi.quantity, 1)),
    0, -- Sin margen, precio fijo de cotización
    qi.subtotal,
    qi.vat_rate,
    qi.vat_amount,
    qi.total, -- Preservar total exacto de la cotización
    CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END,
    'pendiente'::order_status,
    true -- CRÍTICO: Marcar como bloqueado para preservar precios
  FROM public.quote_items qi
  WHERE qi.quote_id = convert_quote_to_order.quote_id; -- Usar nombre completo para evitar ambigüedad
  
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
    'Orden creada desde cotización ' || quote_record.quote_number
  );
  
  RETURN json_build_object(
    'success', true,
    'order_id', order_record.id,
    'order_number', order_record.order_number,
    'quote_number', quote_record.quote_number,
    'total_amount', quote_record.estimated_amount,
    'estimated_delivery_date', new_estimated_delivery,
    'items_converted', total_items_count,
    'client_name', client_record.name
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', 'Error interno: ' || SQLERRM);
END;
$$;