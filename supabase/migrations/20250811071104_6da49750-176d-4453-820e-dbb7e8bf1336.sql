-- Función para cambiar estado a pendiente_entrega cuando se finaliza una orden
CREATE OR REPLACE FUNCTION public.set_pending_delivery_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Solo cambiar a pendiente_entrega cuando se finaliza la orden
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
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

-- Crear trigger para cambiar automáticamente a pendiente_entrega
DROP TRIGGER IF EXISTS trigger_set_pending_delivery ON public.orders;
CREATE TRIGGER trigger_set_pending_delivery
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pending_delivery_on_complete();

-- Función para cerrar definitivamente la orden después de firma y encuesta
CREATE OR REPLACE FUNCTION public.close_order_after_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
      NEW.client_id,
      'Orden cerrada después de entrega y encuesta completada'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para cerrar orden cuando se completa encuesta (después de firma)
DROP TRIGGER IF EXISTS trigger_close_order_after_survey ON public.order_satisfaction_surveys;
CREATE TRIGGER trigger_close_order_after_survey
  AFTER INSERT ON public.order_satisfaction_surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.close_order_after_delivery();