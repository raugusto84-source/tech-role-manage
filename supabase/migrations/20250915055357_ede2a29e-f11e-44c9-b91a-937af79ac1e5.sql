-- Función para crear cobro pendiente cuando una orden es aprobada por el cliente
CREATE OR REPLACE FUNCTION public.create_pending_collection_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_total NUMERIC := 0;
  order_subtotal NUMERIC := 0;
  order_vat_total NUMERIC := 0;
  client_info RECORD;
  collection_exists BOOLEAN;
BEGIN
  -- Solo procesar cuando client_approval cambie a true o status cambie a 'en_proceso'
  IF (NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM true) OR
     (NEW.status = 'en_proceso' AND OLD.status != 'en_proceso' AND NEW.client_approval = true) THEN
    
    -- Verificar si ya existe un cobro pendiente para esta orden
    SELECT EXISTS (
      SELECT 1 FROM pending_collections WHERE order_id = NEW.id
    ) INTO collection_exists;
    
    -- Si ya existe, no crear duplicado
    IF collection_exists THEN
      RAISE LOG 'Pending collection already exists for order %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Obtener información del cliente
    SELECT 
      c.name as client_name,
      c.email as client_email
    INTO client_info
    FROM clients c 
    WHERE c.id = NEW.client_id;
    
    -- Si no encontramos el cliente, usar valores por defecto
    IF client_info.client_name IS NULL THEN
      client_info.client_name := 'Cliente no encontrado';
      client_info.client_email := '';
    END IF;
    
    -- Calcular totales sumando todos los order_items
    SELECT 
      COALESCE(SUM(oi.subtotal), 0),
      COALESCE(SUM(oi.vat_amount), 0),
      COALESCE(SUM(oi.total_amount), 0)
    INTO order_subtotal, order_vat_total, order_total
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Si no hay items, usar el estimated_cost de la orden
    IF order_total = 0 THEN
      order_total := COALESCE(NEW.estimated_cost, 0);
      order_subtotal := order_total * 0.86; -- Aproximar subtotal (asumiendo 16% IVA)
      order_vat_total := order_total - order_subtotal;
    END IF;
    
    -- Crear el cobro pendiente
    INSERT INTO pending_collections (
      order_id,
      order_number,
      client_name,
      client_email,
      estimated_cost,
      delivery_date,
      total_paid,
      remaining_balance,
      total_vat_amount,
      subtotal_without_vat,
      total_with_vat
    ) VALUES (
      NEW.id,
      NEW.order_number,
      client_info.client_name,
      COALESCE(client_info.client_email, ''),
      order_total,
      NEW.delivery_date,
      0, -- total_paid inicial
      order_total, -- remaining_balance inicial
      order_vat_total,
      order_subtotal,
      order_total
    );
    
    RAISE LOG 'Pending collection created for order % with total %', NEW.order_number, order_total;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger para ejecutar la función cuando una orden sea aprobada
DROP TRIGGER IF EXISTS create_pending_collection_on_order_approval ON public.orders;

CREATE TRIGGER create_pending_collection_on_order_approval
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pending_collection_on_approval();