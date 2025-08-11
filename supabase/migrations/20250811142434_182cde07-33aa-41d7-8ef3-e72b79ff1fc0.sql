-- Fix the notify_quote_status_change function to use correct quote_status enum values
CREATE OR REPLACE FUNCTION public.notify_quote_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  message_content TEXT;
  message_type TEXT;
BEGIN
  -- Only send notifications for actual status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'solicitud' THEN
        message_type := 'quote_requested';
        message_content := 'Su cotización #' || NEW.quote_number || ' ha sido recibida y está siendo procesada. Le contactaremos pronto con los detalles.';
      WHEN 'aceptada' THEN
        message_type := 'quote_accepted';
        message_content := 'Su cotización #' || NEW.quote_number || ' ha sido aceptada por $' || NEW.estimated_amount || '. Se procederá a crear la orden de trabajo.';
      WHEN 'rechazada' THEN
        message_type := 'quote_rejected';
        message_content := 'Su cotización #' || NEW.quote_number || ' ha sido rechazada. Si tiene dudas, contáctenos para más información.';
      WHEN 'enviada' THEN
        message_type := 'quote_sent';
        message_content := 'Su cotización #' || NEW.quote_number || ' ha sido enviada y está lista para su revisión.';
      WHEN 'seguimiento' THEN
        message_type := 'quote_followup';
        message_content := 'Estamos en seguimiento de su cotización #' || NEW.quote_number || '. Nos pondremos en contacto con usted pronto.';
      WHEN 'pendiente_aprobacion' THEN
        message_type := 'quote_pending_approval';
        message_content := 'Su cotización #' || NEW.quote_number || ' está pendiente de aprobación interna.';
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
$function$;