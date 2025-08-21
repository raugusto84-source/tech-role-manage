-- Update calculate_estimated_delivery_time to use employee_id instead of user_id
CREATE OR REPLACE FUNCTION public.calculate_estimated_delivery_time(p_order_id uuid)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  technician_id UUID;
  total_service_hours NUMERIC := 0;
  current_workload_hours NUMERIC := 0;
  schedule_record RECORD;
  daily_work_hours NUMERIC;
  current_date_iter DATE := CURRENT_DATE;
  estimated_completion_date DATE;
  estimated_time TIME;
  total_hours_needed NUMERIC;
  days_needed INTEGER;
  work_days INTEGER[];
  days_added INTEGER := 0;
BEGIN
  -- Get the assigned technician for this order
  SELECT assigned_technician INTO technician_id
  FROM public.orders
  WHERE id = p_order_id;
  
  IF technician_id IS NULL THEN
    RETURN now() + INTERVAL '3 days';
  END IF;
  
  -- Use average_service_time from orders as the base estimate (hours)
  SELECT COALESCE(average_service_time, 8) INTO total_service_hours
  FROM public.orders
  WHERE id = p_order_id;
  
  IF total_service_hours = 0 THEN
    total_service_hours := 8;
  END IF;
  
  -- Get current workload (active orders) in hours (assume 6h per order if avg unknown)
  SELECT COUNT(*) * 6 INTO current_workload_hours
  FROM public.orders
  WHERE assigned_technician = technician_id
    AND status IN ('pendiente', 'en_proceso', 'en_camino')
    AND id != p_order_id;
  
  -- Get technician's work schedule (uses employee_id)
  SELECT * INTO schedule_record
  FROM public.work_schedules ws
  WHERE ws.employee_id = technician_id
  ORDER BY ws.created_at DESC
  LIMIT 1;
  
  IF schedule_record IS NULL THEN
    daily_work_hours := 8; -- 9h - 1h break
    work_days := ARRAY[1,2,3,4,5];
  ELSE
    daily_work_hours := EXTRACT(EPOCH FROM (schedule_record.end_time - schedule_record.start_time)) / 3600.0 
                       - (COALESCE(schedule_record.break_duration_minutes, 60) / 60.0);
    IF daily_work_hours <= 0 THEN
      daily_work_hours := 8;
    END IF;
    work_days := schedule_record.work_days;
  END IF;
  
  total_hours_needed := current_workload_hours + total_service_hours;
  days_needed := CEIL(total_hours_needed / daily_work_hours);
  
  WHILE days_added < days_needed LOOP
    current_date_iter := current_date_iter + 1;
    IF EXTRACT(DOW FROM current_date_iter)::INTEGER = ANY(work_days) THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;
  
  estimated_completion_date := current_date_iter;
  
  IF schedule_record IS NULL THEN
    estimated_time := '10:00:00'::TIME;
  ELSE
    estimated_time := schedule_record.start_time;
  END IF;
  
  RETURN (estimated_completion_date || ' ' || estimated_time)::TIMESTAMP WITH TIME ZONE;
END;
$$;