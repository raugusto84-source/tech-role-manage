-- Remove debug trigger
DROP TRIGGER IF EXISTS debug_quote_trigger ON quotes;
DROP FUNCTION IF EXISTS public.debug_quote_update();

-- Create a corrected version of the original trigger
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
    
    -- Buscar el cliente por email
    SELECT id INTO client_record
    FROM public.clients 
    WHERE email = NEW.client_email
    LIMIT 1;
    
    -- Si no existe el cliente, crearlo
    IF client_record.id IS NULL THEN
      INSERT INTO public.clients (name, email, phone, address, created_by)
      VALUES (
        NEW.client_name,
        NEW.client_email,
        COALESCE(NEW.client_phone, ''),
        'Dirección no especificada',
        NEW.assigned_to
      ) RETURNING id INTO client_record;
    END IF;
    
    -- Obtener un tipo de servicio genérico (el primero disponible)
    SELECT id INTO service_type_record
    FROM public.service_types 
    WHERE is_active = true 
    LIMIT 1;
    
    -- Si no hay tipos de servicio, usar NULL
    IF service_type_record.id IS NULL THEN
      service_type_record.id := NULL;
    END IF;
    
    -- Crear la orden con valores explícitos y seguros
    INSERT INTO public.orders (
      client_id,
      service_type,
      failure_description,
      estimated_cost,
      delivery_date,
      created_by,
      assigned_technician,
      status,
      client_approval,
      client_approved_at
    ) VALUES (
      client_record.id,
      service_type_record.id,
      NEW.service_description,
      NEW.estimated_amount,
      CURRENT_DATE + INTERVAL '7 days',
      NEW.assigned_to,
      NULL,
      'pendiente',  -- Simple string value, let Postgres handle the cast
      NULL,
      NULL
    ) RETURNING * INTO order_record;
    
    -- Crear los items de la orden basados en los items de la cotización
    FOR quote_items_record IN 
      SELECT * FROM public.quote_items WHERE quote_id = NEW.id
    LOOP
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
      ) VALUES (
        order_record.id,
        quote_items_record.service_type_id,
        quote_items_record.name,
        quote_items_record.description,
        quote_items_record.quantity,
        quote_items_record.unit_price,
        quote_items_record.unit_price,
        0,
        quote_items_record.subtotal,
        quote_items_record.vat_rate,
        quote_items_record.vat_amount,
        quote_items_record.total,
        CASE WHEN quote_items_record.is_custom THEN 'articulo' ELSE 'servicio' END,
        'pendiente'  -- Simple string value for order_status
      );
      
      order_total := order_total + quote_items_record.total;
    END LOOP;
    
    -- Actualizar el costo estimado de la orden con el total real
    UPDATE public.orders 
    SET estimated_cost = order_total
    WHERE id = order_record.id;
    
    -- Log del proceso
    RAISE LOG 'Orden % creada automáticamente desde cotización %', order_record.order_number, NEW.quote_number;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_create_order_from_approved_quote
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_from_approved_quote();