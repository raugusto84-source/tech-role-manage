-- Fix the order status triggers to work properly

-- First, drop the existing problematic trigger
DROP TRIGGER IF EXISTS set_pending_delivery_trigger ON public.orders;

-- Create a proper trigger that ONLY sets to pendiente_entrega when completing work
CREATE OR REPLACE FUNCTION public.set_pending_delivery_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Solo cambiar a pendiente_entrega cuando se finaliza la orden desde otro estado
  -- Y no cuando ya está en pendiente_entrega
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' AND OLD.status != 'pendiente_entrega' THEN
    NEW.status := 'pendiente_entrega'::order_status;
    
    -- Log del cambio de estado
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      'pendiente_entrega'::order_status,
      auth.uid(),
      'Orden lista para entrega al cliente'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger that fires BEFORE the order status update
CREATE TRIGGER set_pending_delivery_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_pending_delivery_on_complete();

-- Fix the close order after delivery trigger to work with both signatures and surveys
CREATE OR REPLACE FUNCTION public.close_order_after_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar si ya existe firma de entrega y encuesta para esta orden
  IF EXISTS (
    SELECT 1 FROM public.delivery_signatures ds
    WHERE ds.order_id = NEW.order_id
  ) AND EXISTS (
    SELECT 1 FROM public.order_satisfaction_surveys oss
    WHERE oss.order_id = NEW.order_id
  ) THEN
    -- Cerrar definitivamente la orden
    UPDATE public.orders 
    SET status = 'finalizada'::order_status,
        updated_at = now()
    WHERE id = NEW.order_id 
    AND status = 'pendiente_entrega'::order_status;
    
    -- Log del cierre definitivo
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.order_id,
      'pendiente_entrega'::order_status,
      'finalizada'::order_status,
      COALESCE(NEW.client_id, auth.uid()),
      'Orden cerrada después de entrega y encuesta completada'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers and recreate them
DROP TRIGGER IF EXISTS close_order_after_signature ON public.delivery_signatures;
DROP TRIGGER IF EXISTS close_order_after_survey ON public.order_satisfaction_surveys;

-- Create triggers for both delivery signatures and surveys
CREATE TRIGGER close_order_after_signature
AFTER INSERT ON public.delivery_signatures
FOR EACH ROW
EXECUTE FUNCTION public.close_order_after_delivery();

CREATE TRIGGER close_order_after_survey
AFTER INSERT ON public.order_satisfaction_surveys
FOR EACH ROW
EXECUTE FUNCTION public.close_order_after_delivery();

-- Update the current order that should be finalizada since it has both signature and survey
UPDATE public.orders 
SET status = 'finalizada'::order_status,
    updated_at = now()
WHERE id = '5a84cec2-99cd-4977-bda6-779758b203ce' 
AND status = 'pendiente_entrega'::order_status
AND EXISTS (SELECT 1 FROM public.delivery_signatures WHERE order_id = '5a84cec2-99cd-4977-bda6-779758b203ce')
AND EXISTS (SELECT 1 FROM public.order_satisfaction_surveys WHERE order_id = '5a84cec2-99cd-4977-bda6-779758b203ce');