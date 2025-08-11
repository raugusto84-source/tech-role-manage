-- Temporarily disable the notification trigger to isolate the issue
DROP TRIGGER IF EXISTS trigger_order_status_notification ON public.orders;

-- We'll create a simpler trigger that doesn't cause the enum error
CREATE OR REPLACE FUNCTION public.notify_order_status_change_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  message_content TEXT;
  message_type TEXT;
  client_email_val TEXT;
BEGIN
  -- Get client email
  SELECT c.email INTO client_email_val
  FROM public.clients c
  WHERE c.id = NEW.client_id;
  
  -- Only proceed if we have a client email
  IF client_email_val IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Handle different trigger operations with correct enum usage
  IF TG_OP = 'INSERT' THEN
    message_type := 'order_created';
    message_content := 'Nueva orden #' || NEW.order_number || ' creada. Estado: pendiente de aprobación. Costo estimado: $' || NEW.estimated_cost;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    message_type := 'order_modified';
    message_content := 'Orden #' || NEW.order_number || ' actualizada.';
      
    -- Special message for completed orders
    IF NEW.status = 'finalizada' THEN
      message_type := 'order_completed';
      message_content := '¡Trabajo completado! Orden #' || NEW.order_number || ' ha sido finalizada exitosamente.';
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Just log instead of trying to send notification for now
  RAISE LOG 'Order notification: % - %', message_type, message_content;
  
  RETURN NEW;
END;
$function$;

-- Create the new trigger
CREATE TRIGGER trigger_order_status_notification_simple 
AFTER INSERT OR UPDATE ON public.orders 
FOR EACH ROW 
EXECUTE FUNCTION notify_order_status_change_simple();