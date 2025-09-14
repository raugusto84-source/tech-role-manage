-- Fix convert_quote_to_order to preserve exact quote pricing
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(quote_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  quote_record RECORD;
  client_record RECORD;
  order_record RECORD;
  service_type_record RECORD;
  order_total NUMERIC := 0;
  result JSON;
  new_estimated_delivery TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verificar que el usuario tenga permisos
  IF get_user_role_safe() NOT IN ('administrador', 'vendedor') THEN
    RETURN json_build_object('error', 'No tiene permisos para crear órdenes');
  END IF;

  -- Obtener la cotización
  SELECT * INTO quote_record
  FROM public.quotes 
  WHERE id = quote_id AND status = 'aceptada';
  
  IF quote_record.id IS NULL THEN
    RETURN json_build_object('error', 'Cotización no encontrada o no está aceptada');
  END IF;
  
  -- Verificar si ya existe una orden para esta cotización
  IF EXISTS (
    SELECT 1 FROM public.orders o 
    JOIN public.clients c ON c.id = o.client_id 
    WHERE c.email = quote_record.client_email 
    AND o.created_at > quote_record.final_decision_date
  ) THEN
    RETURN json_build_object('error', 'Ya existe una orden para esta cotización');
  END IF;
  
  -- Buscar el cliente por email
  SELECT * INTO client_record
  FROM public.clients 
  WHERE email = quote_record.client_email
  LIMIT 1;
  
  -- Si no existe el cliente, crearlo
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
  
  -- Obtener un tipo de servicio genérico
  SELECT id INTO service_type_record
  FROM public.service_types 
  WHERE is_active = true 
  LIMIT 1;
  
  -- Crear la orden inicialmente con valores básicos
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
    CURRENT_DATE + INTERVAL '7 days', -- Valor temporal
    quote_record.assigned_to,
    NULL,
    'pendiente_aprobacion'::order_status,
    NULL
  ) RETURNING * INTO order_record;
  
  -- Calcular total de items de la cotización
  SELECT COALESCE(SUM(total), 0) INTO order_total
  FROM public.quote_items 
  WHERE quote_id = quote_record.id;
  
  -- Crear los items de la orden preservando exactamente los precios de cotización
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
    estimated_hours,
    shared_time
  ) 
  SELECT 
    order_record.id,
    qi.service_type_id,
    qi.name,
    qi.description,
    qi.quantity,
    -- Preserve exact pricing from quote by calculating backwards from unit_price
    CASE 
      WHEN qi.vat_rate > 0 THEN 
        -- If there's VAT, extract base price from unit_price that includes VAT
        qi.unit_price / (1 + qi.vat_rate / 100.0)
      ELSE 
        -- No VAT, unit_price is the base price
        qi.unit_price
    END as unit_cost_price,
    CASE 
      WHEN qi.vat_rate > 0 THEN 
        -- If there's VAT, extract base price from unit_price that includes VAT
        qi.unit_price / (1 + qi.vat_rate / 100.0)
      ELSE 
        -- No VAT, unit_price is the base price
        qi.unit_price
    END as unit_base_price,
    0, -- No additional profit margin since quote price is already final
    qi.subtotal,
    qi.vat_rate,
    qi.vat_amount,
    qi.total,
    CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END,
    'pendiente'::order_status,
    -- Obtener horas estimadas del service_type o usar un valor por defecto
    COALESCE((SELECT st.estimated_hours FROM service_types st WHERE st.id = qi.service_type_id), 4) * qi.quantity,
    false -- No es tiempo compartido por defecto
  FROM public.quote_items qi
  WHERE qi.quote_id = quote_record.id;
  
  -- Calcular la fecha de entrega estimada usando la nueva lógica
  new_estimated_delivery := public.calculate_estimated_delivery_time(order_record.id);
  
  -- Actualizar la orden con el total y la fecha estimada
  UPDATE public.orders 
  SET 
    estimated_cost = order_total,
    estimated_delivery_date = new_estimated_delivery,
    delivery_date = new_estimated_delivery::date
  WHERE id = order_record.id;
  
  RETURN json_build_object(
    'success', true,
    'order_id', order_record.id,
    'order_number', order_record.order_number,
    'total_amount', order_total,
    'estimated_delivery_date', new_estimated_delivery
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$function$;