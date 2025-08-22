-- Update create_order_for_scheduled_service to ensure orders are created with status 'pendiente'
CREATE OR REPLACE FUNCTION public.create_order_for_scheduled_service(p_scheduled_service_id uuid)
RETURNS TABLE(order_id uuid, order_number text) AS $$
DECLARE
  svc RECORD;
  order_rec RECORD;
  item_rec RECORD;
BEGIN
  -- Get scheduled service details
  SELECT ss.*, 
         pc.clients, 
         pc.insurance_policies,
         st.name as service_name,
         st.description as service_description
  INTO svc 
  FROM public.scheduled_services ss
  JOIN public.policy_clients pc ON pc.id = ss.policy_client_id
  JOIN public.service_types st ON st.id = ss.service_type_id
  WHERE ss.id = p_scheduled_service_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Servicio programado no encontrado'; 
  END IF;

  -- Create order with status 'pendiente'
  INSERT INTO public.orders (
    order_number,
    client_id,
    service_type,
    service_location,
    delivery_date,
    estimated_cost,
    failure_description,
    status,
    is_policy_order,
    order_priority,
    created_by
  ) VALUES (
    'ORD-POL-' || EXTRACT(EPOCH FROM NOW())::bigint || '-' || SUBSTRING(p_scheduled_service_id::text, 1, 8),
    (svc.clients).id,
    'domicilio',
    'domicilio'::jsonb,
    svc.next_service_date,
    0,
    COALESCE(svc.service_description, 'Servicio programado: ' || svc.service_name),
    'pendiente'::order_status,  -- Explicitly set to pendiente
    true,
    svc.priority,
    svc.created_by
  ) RETURNING * INTO order_rec;

  -- Create order items for all services in the bundle
  FOR item_rec IN 
    SELECT ssi.service_type_id, ssi.quantity, st.name, st.description
    FROM public.scheduled_service_items ssi
    JOIN public.service_types st ON st.id = ssi.service_type_id
    WHERE ssi.scheduled_service_id = p_scheduled_service_id
  LOOP
    INSERT INTO public.order_items (
      order_id,
      service_type_id,
      quantity,
      unit_cost_price,
      unit_base_price,
      profit_margin_rate,
      subtotal,
      vat_rate,
      vat_amount,
      total_amount,
      service_name,
      service_description,
      item_type,
      status
    ) VALUES (
      order_rec.id,
      item_rec.service_type_id,
      item_rec.quantity,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      item_rec.name,
      item_rec.description,
      'servicio',
      'pendiente'::order_status  -- Items also start as pendiente
    );
  END LOOP;

  -- Update scheduled service dates
  UPDATE public.scheduled_services 
  SET 
    last_service_date = CURRENT_DATE,
    next_service_date = CURRENT_DATE + INTERVAL '1 day' * frequency_days
  WHERE id = p_scheduled_service_id;

  -- Return order info
  order_id := order_rec.id;
  order_number := order_rec.order_number;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';