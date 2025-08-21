-- Update calculate_estimated_delivery_time to work with proper business hours
CREATE OR REPLACE FUNCTION public.calculate_estimated_delivery_time(p_order_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_service_hours NUMERIC := 0;
  technician_workload INTEGER := 0;
  working_hours_per_day NUMERIC := 8; -- 8 horas laborales por día
  work_start_hour INTEGER := 8; -- 8:00 AM
  work_end_hour INTEGER := 17; -- 5:00 PM
  estimated_days NUMERIC;
  delivery_date TIMESTAMP WITH TIME ZONE;
  business_days_added INTEGER := 0;
  current_date_check TIMESTAMP WITH TIME ZONE;
  hours_remaining NUMERIC;
  current_day_hours NUMERIC;
BEGIN
  -- Calcular total de horas de todos los servicios de la orden
  SELECT COALESCE(SUM(
    CASE 
      WHEN oi.estimated_hours IS NOT NULL THEN oi.estimated_hours
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
  SELECT COALESCE(AVG(technician_orders.order_count), 0)
  INTO technician_workload
  FROM (
    SELECT COUNT(*) as order_count
    FROM orders o
    WHERE o.assigned_technician IS NOT NULL 
      AND o.status IN ('pendiente', 'en_proceso', 'en_camino')
    GROUP BY o.assigned_technician
  ) technician_orders;
  
  -- Ajustar horas por carga de trabajo (cada orden pendiente agrega 4 horas)
  total_service_hours := total_service_hours + (technician_workload * 4);
  
  -- Empezar desde el siguiente día laborable a las 8:00 AM
  current_date_check := CURRENT_DATE + INTERVAL '1 day';
  WHILE EXTRACT(dow FROM current_date_check) NOT BETWEEN 1 AND 5 LOOP
    current_date_check := current_date_check + INTERVAL '1 day';
  END LOOP;
  
  -- Establecer hora de inicio (8:00 AM)
  current_date_check := current_date_check + INTERVAL '8 hours';
  
  -- Distribuir las horas en días laborales
  hours_remaining := total_service_hours;
  
  WHILE hours_remaining > 0 LOOP
    -- Si no es día laborable, saltar al siguiente
    WHILE EXTRACT(dow FROM current_date_check) NOT BETWEEN 1 AND 5 LOOP
      current_date_check := current_date_check + INTERVAL '1 day';
    END LOOP;
    
    -- Calcular cuántas horas se pueden trabajar en el día actual
    current_day_hours := LEAST(hours_remaining, working_hours_per_day);
    hours_remaining := hours_remaining - current_day_hours;
    
    -- Si aún quedan horas, pasar al siguiente día laborable
    IF hours_remaining > 0 THEN
      current_date_check := current_date_check + INTERVAL '1 day';
      -- Resetear a las 8:00 AM del nuevo día
      current_date_check := DATE_TRUNC('day', current_date_check) + INTERVAL '8 hours';
    ELSE
      -- Calcular la hora final del último día
      current_date_check := current_date_check + INTERVAL '1 hour' * current_day_hours;
    END IF;
  END LOOP;
  
  delivery_date := current_date_check;
  
  -- Log para debugging
  RAISE LOG 'Order %: Total hours: %, Final delivery: %', 
    p_order_id, total_service_hours, delivery_date;
  
  RETURN delivery_date;
END;
$function$;