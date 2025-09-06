-- Crear trigger para generar cobro pendiente al crear orden
CREATE OR REPLACE FUNCTION public.create_pending_collection_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  client_info RECORD;
BEGIN
  -- Solo crear cobro pendiente cuando se crea una nueva orden
  IF TG_OP = 'INSERT' THEN
    -- Obtener información del cliente
    SELECT c.name, c.email, c.phone 
    INTO client_info
    FROM public.clients c 
    WHERE c.id = NEW.client_id;
    
    -- Crear registro en pending_collections
    INSERT INTO public.pending_collections (
      order_id,
      client_id,
      amount,
      description,
      due_date,
      status,
      created_by,
      client_name,
      client_email,
      client_phone
    ) VALUES (
      NEW.id,
      NEW.client_id,
      NEW.estimated_cost,
      'Cobro orden #' || NEW.order_number || ' - ' || COALESCE(NEW.failure_description, 'Servicio técnico'),
      NEW.delivery_date,
      'pendiente',
      NEW.created_by,
      client_info.name,
      client_info.email,
      client_info.phone
    );
    
    RAISE LOG 'Pending collection created for order % with amount %', NEW.order_number, NEW.estimated_cost;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger
DROP TRIGGER IF EXISTS create_pending_collection_trigger ON public.orders;
CREATE TRIGGER create_pending_collection_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pending_collection_on_order();

-- Agregar campo service_category a orders si no existe
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS service_category text DEFAULT 'sistemas';