-- Improve uniqueness for order numbers created by scheduled services
CREATE OR REPLACE FUNCTION public.create_scheduled_service_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_data RECORD;
  service_data RECORD;
  order_data RECORD;
  is_home BOOLEAN := false;
  location_json jsonb := NULL;
  order_no text;
  attempt int := 0;
BEGIN
  -- Get client information from policy_clients
  SELECT 
    pc.id as policy_client_id,
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    ip.policy_name,
    ip.id as policy_id
  INTO client_data
  FROM policy_clients pc
  JOIN clients c ON c.id = pc.client_id
  JOIN insurance_policies ip ON ip.id = pc.policy_id
  WHERE pc.id = NEW.policy_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró información del cliente para la póliza';
  END IF;

  -- Get service type information
  SELECT name, description INTO service_data
  FROM service_types
  WHERE id = NEW.service_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el tipo de servicio especificado';
  END IF;

  -- Determine if it's a home service based on service name
  is_home := position('domicilio' in lower(coalesce(service_data.name, ''))) > 0;
  IF is_home THEN
    location_json := jsonb_build_object('type', 'domicilio');
  END IF;

  -- Try to insert order with a unique generated number (retry on conflict)
  FOR attempt IN 1..5 LOOP
    BEGIN
      order_no := public.generate_order_number();

      INSERT INTO orders (
        order_number,
        client_id,
        service_type,          -- UUID expected
        service_location,      -- JSONB
        delivery_date,
        estimated_cost,
        failure_description,
        status,
        is_policy_order,
        order_priority,
        created_by,
        is_home_service,
        policy_id,
        policy_name
      ) VALUES (
        order_no,
        client_data.client_id,
        NEW.service_type_id,            -- Use UUID from scheduled service
        location_json,                  -- JSONB or NULL
        NEW.next_service_date,
        0,
        COALESCE(NEW.service_description, 'Servicio programado: ' || service_data.name),
        'pendiente',
        true,
        NEW.priority,
        NEW.created_by,
        is_home,
        client_data.policy_id,
        client_data.policy_name
      ) RETURNING * INTO order_data;

      EXIT; -- success
    EXCEPTION WHEN unique_violation THEN
      -- Retry with a new generated number
      CONTINUE;
    END;
  END LOOP;

  IF order_data.id IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar un número de orden único, intente nuevamente';
  END IF;

  -- Create order item for the scheduled service
  INSERT INTO order_items (
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
    status,
    policy_name
  ) VALUES (
    order_data.id,
    NEW.service_type_id,
    GREATEST(NEW.quantity, 1),
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    service_data.name,
    service_data.description,
    'servicio',
    'pendiente',
    client_data.policy_name
  );

  RAISE LOG 'Orden automática creada: % para servicio programado %', order_data.order_number, NEW.id;

  RETURN NEW;
END;
$$;