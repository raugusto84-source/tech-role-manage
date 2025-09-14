-- Fix convert_quote_to_order to use exact QuoteCard total (estimated_amount)
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
  service_type_record RECORD;
  new_estimated_delivery TIMESTAMP WITH TIME ZONE;
BEGIN
  IF get_user_role_safe() NOT IN ('administrador', 'vendedor') THEN
    RETURN json_build_object('error', 'No tiene permisos para crear órdenes');
  END IF;

  SELECT * INTO quote_record
  FROM public.quotes 
  WHERE id = quote_id AND status = 'aceptada';
  
  IF quote_record.id IS NULL THEN
    RETURN json_build_object('error', 'Cotización no encontrada o no está aceptada');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.orders o 
    JOIN public.clients c ON c.id = o.client_id 
    WHERE c.email = quote_record.client_email 
    AND o.created_at > quote_record.final_decision_date
  ) THEN
    RETURN json_build_object('error', 'Ya existe una orden para esta cotización');
  END IF;
  
  SELECT * INTO client_record
  FROM public.clients 
  WHERE email = quote_record.client_email
  LIMIT 1;
  
  IF client_record.id IS NULL THEN
    INSERT INTO public.clients (name, email, phone, address, created_by)
    VALUES (
      quote_record.client_name,
      quote_record.client_email,
      COALESCE(quote_record.client_phone, ''),
      'Dirección no especificada',
      quote_record.assigned_to
    ) RETURNING * INTO client_record;
  END IF;
  
  SELECT id INTO service_type_record
  FROM public.service_types 
  WHERE is_active = true 
  LIMIT 1;
  
  INSERT INTO public.orders (
    client_id,
    service_type,
    failure_description,
    estimated_cost,
    delivery_date,
    created_by,
    assigned_technician,
    status,
    client_approval
  ) VALUES (
    client_record.id,
    service_type_record.id,
    quote_record.service_description,
    quote_record.estimated_amount, -- Usar el total exacto del QuoteCard
    CURRENT_DATE + INTERVAL '7 days',
    quote_record.assigned_to,
    NULL,
    'pendiente_aprobacion'::order_status,
    NULL
  ) RETURNING * INTO order_record;
  
  -- Insertar order_items preservando los totales exactos de la cotización
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
    qi.service_type_id,
    qi.name,
    qi.description,
    qi.quantity,
    -- Preservar precios exactos de la cotización
    qi.subtotal / qi.quantity as unit_cost_price,
    qi.subtotal / qi.quantity as unit_base_price,
    0 as profit_margin_rate,
    qi.subtotal, -- Preservar subtotal exacto
    qi.vat_rate, -- Preservar tasa de IVA
    qi.vat_amount, -- Preservar monto de IVA exacto
    qi.total, -- Preservar total exacto (subtotal + IVA)
    CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END,
    'pendiente'::order_status,
    true -- lock pricing to preserve quote totals exactly
  FROM public.quote_items qi
  WHERE qi.quote_id = quote_record.id;
  
  -- Calcular fecha estimada de entrega
  new_estimated_delivery := public.calculate_estimated_delivery_time(order_record.id);
  
  -- Actualizar orden solo con fecha de entrega (mantener estimated_amount del QuoteCard)
  UPDATE public.orders 
  SET 
    estimated_delivery_date = new_estimated_delivery,
    delivery_date = new_estimated_delivery::date
  WHERE id = order_record.id;
  
  RETURN json_build_object(
    'success', true,
    'order_id', order_record.id,
    'order_number', order_record.order_number,
    'total_amount', quote_record.estimated_amount, -- Devolver el total exacto del QuoteCard
    'estimated_delivery_date', new_estimated_delivery
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$function$