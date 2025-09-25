-- Update legacy auto-order trigger to be compatible with new multi-service format
-- 1) Update function to safely skip when JSON services are present
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
BEGIN
  -- If the new multi-service JSON format is used, skip legacy auto-order creation
  IF NEW.services IS NOT NULL THEN
    RAISE LOG 'Skipping legacy auto-order for multi-service scheduled_service %', NEW.id;
    RETURN NEW;
  END IF;

  -- Get client information from policy_clients
  SELECT 
    pc.id as policy_client_id,
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    ip.policy_name
  INTO client_data
  FROM policy_clients pc
  JOIN clients c ON c.id = pc.client_id
  JOIN insurance_policies ip ON ip.id = pc.policy_id
  WHERE pc.id = NEW.policy_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró información del cliente para la póliza';
  END IF;

  -- Only attempt to load a single service_type when present (legacy records)
  IF NEW.service_type_id IS NULL THEN
    RAISE LOG 'No legacy service_type_id for scheduled_service %, skipping auto-order', NEW.id;
    RETURN NEW;
  END IF;

  -- Get service type information
  SELECT name, description INTO service_data
  FROM service_types
  WHERE id = NEW.service_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el tipo de servicio especificado';
  END IF;

  -- Create the initial order for this scheduled service (legacy path)
  INSERT INTO orders (
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
    'ORD-POL-' || extract(epoch from now())::bigint::text,
    client_data.client_id,
    'domicilio',
    'domicilio',
    NEW.next_service_date,
    0,
    COALESCE(NEW.service_description, 'Servicio programado: ' || service_data.name),
    'pendiente',
    true,
    NEW.priority,
    NEW.created_by
  ) RETURNING * INTO order_data;

  -- Create order item for the scheduled service (legacy single item)
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
    status
  ) VALUES (
    order_data.id,
    NEW.service_type_id,
    1,
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
    'pendiente'
  );

  RAISE LOG 'Orden automática creada (legacy): % para servicio programado %', order_data.order_number, NEW.id;

  RETURN NEW;
END;
$$;

-- 2) Make the trigger run only for legacy records (no JSON services)
DROP TRIGGER IF EXISTS trg_create_scheduled_service_order ON public.scheduled_services;
CREATE TRIGGER trg_create_scheduled_service_order
AFTER INSERT ON public.scheduled_services
FOR EACH ROW 
WHEN (NEW.is_active = true AND NEW.services IS NULL)
EXECUTE FUNCTION public.create_scheduled_service_order();