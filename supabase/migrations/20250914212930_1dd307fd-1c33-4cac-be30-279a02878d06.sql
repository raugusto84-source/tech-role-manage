-- Make convert_quote_to_order idempotent and fix duplicate detection
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
  existing_order RECORD;
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
  
  -- Ensure client exists (or create)
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

  -- Idempotency: if an order matching this quote already exists, return it instead of error
  SELECT o.* INTO existing_order
  FROM public.orders o
  WHERE o.client_id = client_record.id
    AND COALESCE(o.failure_description, '') = COALESCE(quote_record.service_description, '')
    AND ABS(COALESCE(o.estimated_cost, 0) - COALESCE(quote_record.estimated_amount, 0)) < 0.01
  ORDER BY o.created_at DESC
  LIMIT 1;
  
  IF existing_order.id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'existing', true,
      'order_id', existing_order.id,
      'order_number', existing_order.order_number,
      'total_amount', quote_record.estimated_amount
    );
  END IF;
  
  -- Pick any active service type as placeholder
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
    quote_record.estimated_amount,
    CURRENT_DATE + INTERVAL '7 days',
    quote_record.assigned_to,
    NULL,
    'pendiente_aprobacion'::order_status,
    NULL
  ) RETURNING * INTO order_record;
  
  -- Preserve exact totals from quote items
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
    (qi.subtotal / NULLIF(qi.quantity, 0)),
    (qi.subtotal / NULLIF(qi.quantity, 0)),
    0,
    qi.subtotal,
    COALESCE(qi.vat_rate, 0),
    COALESCE(qi.vat_amount, 0),
    qi.total,
    CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END,
    'pendiente'::order_status,
    true
  FROM public.quote_items qi
  WHERE qi.quote_id = quote_record.id;
  
  -- Calculate estimated delivery
  new_estimated_delivery := public.calculate_estimated_delivery_time(order_record.id);
  
  UPDATE public.orders 
  SET 
    estimated_delivery_date = new_estimated_delivery,
    delivery_date = new_estimated_delivery::date
  WHERE id = order_record.id;
  
  RETURN json_build_object(
    'success', true,
    'order_id', order_record.id,
    'order_number', order_record.order_number,
    'total_amount', quote_record.estimated_amount,
    'estimated_delivery_date', new_estimated_delivery
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$function$