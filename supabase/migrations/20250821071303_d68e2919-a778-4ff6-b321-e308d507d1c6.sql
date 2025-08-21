-- Fix the calculate_estimated_delivery_time function with proper syntax
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
    -- No technician assigned, return a default estimate (3 days)
    RETURN now() + INTERVAL '3 days';
  END IF;
  
  -- Calculate total estimated hours for this order using average_service_time from orders
  SELECT COALESCE(average_service_time, 8) INTO total_service_hours
  FROM public.orders
  WHERE id = p_order_id;
  
  -- If no estimated hours, use a default
  IF total_service_hours = 0 THEN
    total_service_hours := 8; -- Default 8 hours
  END IF;
  
  -- Get current workload (count active orders for this technician)
  SELECT COUNT(*) * 6 INTO current_workload_hours -- Assume 6 hours per order on average
  FROM public.orders
  WHERE assigned_technician = technician_id
    AND status IN ('pendiente', 'en_proceso', 'en_camino')
    AND id != p_order_id; -- Exclude the current order
  
  -- Get technician's work schedule
  SELECT * INTO schedule_record
  FROM public.work_schedules ws
  WHERE ws.user_id = technician_id
  ORDER BY ws.created_at DESC
  LIMIT 1;
  
  -- If no schedule found, use default (8 AM to 5 PM, Mon-Fri, 1 hour break)
  IF schedule_record IS NULL THEN
    daily_work_hours := 8; -- 9 hours - 1 hour break
    work_days := ARRAY[1,2,3,4,5]; -- Mon-Fri
  ELSE
    -- Calculate daily work hours from schedule
    daily_work_hours := EXTRACT(EPOCH FROM (schedule_record.end_time - schedule_record.start_time)) / 3600.0 
                       - (COALESCE(schedule_record.break_duration_minutes, 60) / 60.0);
    work_days := schedule_record.work_days;
  END IF;
  
  -- Calculate days needed considering current workload + new order
  total_hours_needed := current_workload_hours + total_service_hours;
  days_needed := CEIL(total_hours_needed / daily_work_hours);
  
  -- Find the estimated completion date
  WHILE days_added < days_needed LOOP
    current_date_iter := current_date_iter + 1;
    -- Check if current date's day of week is in work_days
    IF EXTRACT(DOW FROM current_date_iter)::INTEGER = ANY(work_days) THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;
  
  estimated_completion_date := current_date_iter;
  
  -- Set estimated time (use schedule start time or default 10 AM)
  IF schedule_record IS NULL THEN
    estimated_time := '10:00:00'::TIME;
  ELSE
    estimated_time := schedule_record.start_time;
  END IF;
  
  -- Combine date and time
  RETURN (estimated_completion_date || ' ' || estimated_time)::TIMESTAMP WITH TIME ZONE;
END;
$$;