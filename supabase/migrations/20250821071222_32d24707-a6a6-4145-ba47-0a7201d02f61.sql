-- Fix the calculate_estimated_delivery_time function to use correct columns
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
  current_date DATE := CURRENT_DATE;
  estimated_completion_date DATE;
  estimated_time TIME;
BEGIN
  -- Get the assigned technician for this order
  SELECT assigned_technician INTO technician_id
  FROM public.orders
  WHERE id = p_order_id;
  
  IF technician_id IS NULL THEN
    -- No technician assigned, return a default estimate (3 days)
    RETURN now() + INTERVAL '3 days';
  END IF;
  
  -- Calculate total estimated hours for this order using service_types table
  SELECT COALESCE(SUM(st.estimated_hours * oi.quantity), 8) INTO total_service_hours
  FROM public.order_items oi
  JOIN public.service_types st ON st.id = oi.service_type_id
  WHERE oi.order_id = p_order_id;
  
  -- If no estimated hours in service_types, use a default
  IF total_service_hours = 0 THEN
    total_service_hours := 8; -- Default 8 hours
  END IF;
  
  -- Get current workload (sum of estimated hours for pending/in-progress orders)
  SELECT COALESCE(SUM(st.estimated_hours * oi.quantity), 0) INTO current_workload_hours
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.service_types st ON st.id = oi.service_type_id
  WHERE o.assigned_technician = technician_id
    AND o.status IN ('pendiente', 'en_proceso', 'en_camino')
    AND o.id != p_order_id; -- Exclude the current order
  
  -- Get technician's work schedule
  SELECT * INTO schedule_record
  FROM public.work_schedules ws
  WHERE ws.user_id = technician_id
  ORDER BY ws.created_at DESC
  LIMIT 1;
  
  -- If no schedule found, use default (8 AM to 5 PM, Mon-Fri, 1 hour break)
  IF schedule_record IS NULL THEN
    daily_work_hours := 8; -- 9 hours - 1 hour break
  ELSE
    -- Calculate daily work hours from schedule
    daily_work_hours := EXTRACT(EPOCH FROM (schedule_record.end_time - schedule_record.start_time)) / 3600.0 
                       - (COALESCE(schedule_record.break_duration_minutes, 60) / 60.0);
  END IF;
  
  -- Calculate days needed considering current workload + new order
  DECLARE
    total_hours_needed NUMERIC := current_workload_hours + total_service_hours;
    days_needed INTEGER := CEIL(total_hours_needed / daily_work_hours);
    work_days INTEGER[];
    days_added INTEGER := 0;
  BEGIN
    -- Get work days (default to Monday-Friday if no schedule)
    IF schedule_record IS NULL THEN
      work_days := ARRAY[1,2,3,4,5]; -- Mon-Fri
    ELSE
      work_days := schedule_record.work_days;
    END IF;
    
    -- Find the estimated completion date
    WHILE days_added < days_needed LOOP
      current_date := current_date + 1;
      -- Check if current date's day of week is in work_days
      IF EXTRACT(DOW FROM current_date)::INTEGER = ANY(work_days) THEN
        days_added := days_added + 1;
      END IF;
    END LOOP;
    
    estimated_completion_date := current_date;
  END;
  
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