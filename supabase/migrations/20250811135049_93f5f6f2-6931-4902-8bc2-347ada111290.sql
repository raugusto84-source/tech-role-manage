-- Create triggers for automatic WhatsApp notifications

-- Trigger for quote status changes
CREATE OR REPLACE FUNCTION public.notify_quote_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  message_content TEXT;
  message_type TEXT;
BEGIN
  -- Only send notifications for actual status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'pendiente' THEN
        message_type := 'quote_requested';
        message_content := 'Su cotización #' || NEW.quote_number || ' ha sido recibida y está siendo procesada. Le contactaremos pronto con los detalles.';
      WHEN 'aceptada' THEN
        message_type := 'quote_accepted';
        message_content := 'Su cotización #' || NEW.quote_number || ' ha sido aceptada por $' || NEW.estimated_amount || '. Se procederá a crear la orden de trabajo.';
      WHEN 'rechazada' THEN
        message_type := 'quote_rejected';
        message_content := 'Su cotización #' || NEW.quote_number || ' ha sido rechazada. Si tiene dudas, contáctenos para más información.';
      ELSE
        RETURN NEW;
    END CASE;
    
    -- Send notification
    PERFORM public.send_whatsapp_notification(
      NEW.client_email,
      message_type,
      NEW.id,
      'quote',
      message_content
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  
  -- Handle different trigger operations
  IF TG_OP = 'INSERT' THEN
    message_type := 'order_created';
    message_content := 'Nueva orden #' || NEW.order_number || ' creada. Estado: ' || 
      CASE NEW.status 
        WHEN 'pendiente_aprobacion' THEN 'Pendiente de su aprobación'
        WHEN 'pendiente' THEN 'Pendiente de asignación'
        ELSE NEW.status
      END || '. Costo estimado: $' || NEW.estimated_cost;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    message_type := 'order_modified';
    message_content := 'Orden #' || NEW.order_number || ' actualizada. Nuevo estado: ' ||
      CASE NEW.status
        WHEN 'pendiente' THEN 'Pendiente de asignación'
        WHEN 'en_camino' THEN 'Técnico en camino'
        WHEN 'en_proceso' THEN 'Trabajo en progreso'
        WHEN 'finalizada' THEN 'Trabajo completado'
        WHEN 'pendiente_entrega' THEN 'Listo para entrega'
        WHEN 'cancelada' THEN 'Cancelada'
        ELSE NEW.status
      END;
      
    -- Special message for completed orders
    IF NEW.status = 'finalizada' THEN
      message_type := 'order_completed';
      message_content := '¡Trabajo completado! Orden #' || NEW.order_number || ' ha sido finalizada exitosamente. Gracias por confiar en nuestros servicios.';
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Send notification
  PERFORM public.send_whatsapp_notification(
    client_email_val,
    message_type,
    NEW.id,
    'order',
    message_content
  );
  
  RETURN NEW;
END;
$$;

-- Create the triggers
DROP TRIGGER IF EXISTS trigger_quote_status_notification ON public.quotes;
CREATE TRIGGER trigger_quote_status_notification
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_quote_status_change();

DROP TRIGGER IF EXISTS trigger_order_status_notification ON public.orders;
CREATE TRIGGER trigger_order_status_notification
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();