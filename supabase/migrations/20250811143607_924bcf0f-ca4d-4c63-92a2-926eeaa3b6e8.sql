-- Let's completely rewrite the trigger with better error handling and debugging
CREATE OR REPLACE FUNCTION public.create_order_from_approved_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  client_record RECORD;
  quote_items_record RECORD;
  order_record RECORD;
  service_type_record RECORD;
  order_total NUMERIC := 0;
BEGIN
  -- Solo procesar cuando la cotización cambia a estado 'aceptada'
  IF NEW.status = 'aceptada' AND (OLD.status IS NULL OR OLD.status != 'aceptada') THEN
    
    RAISE LOG 'Starting quote to order conversion for quote %', NEW.quote_number;
    
    -- Buscar el cliente por email
    SELECT id INTO client_record
    FROM public.clients 
    WHERE email = NEW.client_email
    LIMIT 1;
    
    -- Si no existe el cliente, crearlo
    IF client_record.id IS NULL THEN
      RAISE LOG 'Creating new client for email %', NEW.client_email;
      INSERT INTO public.clients (name, email, phone, address, created_by)
      VALUES (
        NEW.client_name,
        NEW.client_email,
        COALESCE(NEW.client_phone, ''),
        'Dirección no especificada',
        NEW.assigned_to
      ) RETURNING id INTO client_record;
      RAISE LOG 'Created client with id %', client_record.id;
    ELSE
      RAISE LOG 'Found existing client with id %', client_record.id;
    END IF;
    
    -- Obtener un tipo de servicio genérico (el primero disponible)
    SELECT id INTO service_type_record
    FROM public.service_types 
    WHERE is_active = true 
    LIMIT 1;
    
    -- Si no hay tipos de servicio, usar NULL
    IF service_type_record.id IS NULL THEN
      RAISE LOG 'No active service types found, using NULL';
      service_type_record.id := NULL;
    ELSE
      RAISE LOG 'Using service type %', service_type_record.id;
    END IF;
    
    RAISE LOG 'About to create order with status pendiente';
    
    -- Crear la orden - simplified approach
    INSERT INTO public.orders (
      client_id,
      service_type,
      failure_description,
      estimated_cost,
      delivery_date,
      created_by,
      assigned_technician,
      status
    ) VALUES (
      client_record.id,
      service_type_record.id,
      NEW.service_description,
      NEW.estimated_amount,
      CURRENT_DATE + INTERVAL '7 days',
      NEW.assigned_to,
      NULL,
      'pendiente'
    ) RETURNING * INTO order_record;
    
    RAISE LOG 'Created order % with status %', order_record.order_number, order_record.status;
    
    -- Calculate total from quote items
    SELECT COALESCE(SUM(total), 0) INTO order_total
    FROM public.quote_items 
    WHERE quote_id = NEW.id;
    
    -- Create order items
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
      status
    ) 
    SELECT 
      order_record.id,
      qi.service_type_id,
      qi.name,
      qi.description,
      qi.quantity,
      qi.unit_price,
      qi.unit_price,
      0,
      qi.subtotal,
      qi.vat_rate,
      qi.vat_amount,
      qi.total,
      CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END,
      'pendiente'
    FROM public.quote_items qi
    WHERE qi.quote_id = NEW.id;
    
    -- Update order total
    UPDATE public.orders 
    SET estimated_cost = order_total
    WHERE id = order_record.id;
    
    RAISE LOG 'Order % created successfully with total %', order_record.order_number, order_total;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in create_order_from_approved_quote: % %', SQLERRM, SQLSTATE;
    -- Don't fail the whole transaction, just log the error
    RETURN NEW;
END;
$function$;