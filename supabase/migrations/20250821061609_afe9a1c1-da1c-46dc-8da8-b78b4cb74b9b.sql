-- Agregar campo para fecha estimada de entrega
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP WITH TIME ZONE;

-- Función para calcular tiempo estimado de entrega
CREATE OR REPLACE FUNCTION public.calculate_estimated_delivery_time(p_order_id UUID)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_service_hours NUMERIC := 0;
  technician_workload INTEGER := 0;
  working_hours_per_day NUMERIC := 8; -- Asumiendo 8 horas laborales por día
  estimated_days NUMERIC;
  delivery_date TIMESTAMP WITH TIME ZONE;
  business_days_added INTEGER := 0;
  current_date_check TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calcular total de horas de todos los servicios de la orden
  SELECT COALESCE(SUM(
    CASE 
      WHEN st.estimated_hours IS NOT NULL THEN st.estimated_hours * oi.quantity
      ELSE 4 -- Tiempo por defecto si no está especificado
    END
  ), 0)
  INTO total_service_hours
  FROM order_items oi
  LEFT JOIN service_types st ON st.id = oi.service_type_id
  WHERE oi.order_id = p_order_id;
  
  -- Si no hay servicios identificados, usar tiempo base
  IF total_service_hours = 0 THEN
    total_service_hours := 4; -- 4 horas por defecto
  END IF;
  
  -- Verificar carga actual de trabajo de técnicos disponibles
  -- Contar órdenes activas promedio por técnico
  SELECT COALESCE(AVG(technician_orders.order_count), 0)
  INTO technician_workload
  FROM (
    SELECT COUNT(*) as order_count
    FROM orders o
    WHERE o.assigned_technician IS NOT NULL 
      AND o.status IN ('pendiente', 'en_proceso', 'en_camino')
    GROUP BY o.assigned_technician
  ) technician_orders;
  
  -- Calcular días estimados basado en:
  -- 1. Horas totales de servicio
  -- 2. Carga de trabajo actual (cada orden pendiente agrega 0.5 días)
  estimated_days := (total_service_hours / working_hours_per_day) + (technician_workload * 0.5);
  
  -- Mínimo 1 día, máximo 15 días
  estimated_days := GREATEST(1, LEAST(estimated_days, 15));
  
  -- Agregar días laborales (lunes a viernes)
  current_date_check := CURRENT_TIMESTAMP;
  
  WHILE business_days_added < estimated_days LOOP
    current_date_check := current_date_check + INTERVAL '1 day';
    
    -- Solo contar días laborales (lunes=1 a viernes=5)
    IF EXTRACT(dow FROM current_date_check) BETWEEN 1 AND 5 THEN
      business_days_added := business_days_added + 1;
    END IF;
  END LOOP;
  
  delivery_date := current_date_check;
  
  -- Log para debugging
  RAISE LOG 'Order %: Total hours: %, Technician workload: %, Estimated days: %, Delivery date: %', 
    p_order_id, total_service_hours, technician_workload, estimated_days, delivery_date;
  
  RETURN delivery_date;
END;
$$;

-- Actualizar función de aprobación del cliente para incluir cálculo de tiempo
CREATE OR REPLACE FUNCTION public.approve_order_by_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  estimated_delivery TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Solo procesar cuando el cliente aprueba la orden
  IF NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM NEW.client_approval THEN
    
    -- Calcular fecha estimada de entrega
    estimated_delivery := public.calculate_estimated_delivery_time(NEW.id);
    
    -- Actualizar la orden con el tiempo estimado
    NEW.status := 'pendiente'::order_status;
    NEW.client_approved_at := now();
    NEW.estimated_delivery_date := estimated_delivery;
    
    -- Registrar el cambio en los logs
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      'pendiente'::order_status,
      auth.uid(),
      COALESCE(NEW.client_approval_notes, 'Orden aprobada por el cliente') || 
      '. Fecha estimada de entrega: ' || to_char(estimated_delivery, 'DD/MM/YYYY HH24:MI')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Función para recalcular tiempo de entrega cuando se asigna técnico
CREATE OR REPLACE FUNCTION public.update_delivery_estimate_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_estimated_delivery TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Recalcular cuando se asigna un técnico
  IF NEW.assigned_technician IS NOT NULL AND (OLD.assigned_technician IS NULL OR OLD.assigned_technician != NEW.assigned_technician) THEN
    
    new_estimated_delivery := public.calculate_estimated_delivery_time(NEW.id);
    NEW.estimated_delivery_date := new_estimated_delivery;
    
    -- Log del cambio
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      'Técnico asignado. Nueva fecha estimada de entrega: ' || to_char(new_estimated_delivery, 'DD/MM/YYYY HH24:MI')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para recalcular tiempo cuando se asigna técnico
DROP TRIGGER IF EXISTS update_delivery_estimate_on_assignment_trigger ON public.orders;
CREATE TRIGGER update_delivery_estimate_on_assignment_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_delivery_estimate_on_assignment();

-- Comentarios para documentar
COMMENT ON COLUMN public.orders.estimated_delivery_date IS 'Fecha y hora estimada de entrega calculada automáticamente basada en tiempos de servicio y disponibilidad de técnicos';

COMMENT ON FUNCTION public.calculate_estimated_delivery_time(UUID) IS 'Calcula el tiempo estimado de entrega basado en horas de servicios y carga de trabajo actual de técnicos';