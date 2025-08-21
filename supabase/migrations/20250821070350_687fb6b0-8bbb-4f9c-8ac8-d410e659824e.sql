-- Recompute estimated delivery using technician's registered work schedule when available
CREATE OR REPLACE FUNCTION public.calculate_estimated_delivery_time(p_order_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_service_hours NUMERIC := 0;
  v_technician_workload INTEGER := 0;
  v_assigned_technician UUID;
  v_schedule RECORD;
  v_working_hours_per_day NUMERIC := 8; -- fallback
  v_start_time TIME := TIME '08:00';
  v_end_time TIME := TIME '17:00';
  v_break_mins INTEGER := 60;
  v_work_days INT[] := ARRAY[1,2,3,4,5]; -- Mon-Fri
  v_now TIMESTAMPTZ := now();
  v_current_ts TIMESTAMPTZ;
  v_hours_remaining NUMERIC;
  v_remaining_today NUMERIC;
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
BEGIN
  -- Total service hours from items (prefer item.estimated_hours, fall back to service_types)
  SELECT COALESCE(SUM(
    CASE 
      WHEN oi.estimated_hours IS NOT NULL THEN oi.estimated_hours
      WHEN st.estimated_hours IS NOT NULL THEN st.estimated_hours * oi.quantity
      ELSE 4
    END
  ), 0)
  INTO v_total_service_hours
  FROM public.order_items oi
  LEFT JOIN public.service_types st ON st.id = oi.service_type_id
  WHERE oi.order_id = p_order_id;

  IF v_total_service_hours = 0 THEN
    v_total_service_hours := 4;
  END IF;

  -- Assigned technician (to pick schedule)
  SELECT assigned_technician INTO v_assigned_technician
  FROM public.orders WHERE id = p_order_id;

  -- Try to load technician schedule
  IF v_assigned_technician IS NOT NULL THEN
    SELECT ws.start_time, ws.end_time, ws.work_days, ws.break_duration_minutes
    INTO v_schedule
    FROM public.work_schedules ws
    WHERE ws.employee_id = v_assigned_technician AND ws.is_active = true
    ORDER BY ws.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_start_time := v_schedule.start_time;
      v_end_time := v_schedule.end_time;
      v_work_days := v_schedule.work_days;
      v_break_mins := COALESCE(v_schedule.break_duration_minutes, 60);
    END IF;
  END IF;

  -- Compute working hours per day based on schedule
  v_working_hours_per_day := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0 - (v_break_mins / 60.0);
  IF v_working_hours_per_day <= 0 THEN
    v_working_hours_per_day := 8; -- safety fallback
  END IF;

  -- Adjust workload: average active orders per technician adds 0.5 day-equivalent
  SELECT COALESCE(AVG(t.order_count), 0)
  INTO v_technician_workload
  FROM (
    SELECT COUNT(*) AS order_count
    FROM public.orders o
    WHERE o.assigned_technician IS NOT NULL 
      AND o.status IN ('pendiente','en_proceso','en_camino')
    GROUP BY o.assigned_technician
  ) t;

  v_total_service_hours := v_total_service_hours + (v_technician_workload * (v_working_hours_per_day * 0.5));

  -- Start from 'now' aligned to schedule
  v_current_ts := v_now;

  -- Move to next valid work day/time
  LOOP
    -- If day of week not in work_days, go to next day 00:00
    IF NOT (EXTRACT(dow FROM v_current_ts)::int = ANY (v_work_days)) THEN
      v_current_ts := date_trunc('day', v_current_ts) + INTERVAL '1 day';
      CONTINUE;
    END IF;

    v_day_start := date_trunc('day', v_current_ts) + v_start_time;
    v_day_end := date_trunc('day', v_current_ts) + v_end_time;

    -- If before day start, set to start; if after day end, move to next day
    IF v_current_ts < v_day_start THEN
      v_current_ts := v_day_start;
      EXIT; -- valid start
    ELSIF v_current_ts >= v_day_end THEN
      v_current_ts := date_trunc('day', v_current_ts) + INTERVAL '1 day';
      CONTINUE; -- check next day
    ELSE
      -- Inside working window already
      EXIT;
    END IF;
  END LOOP;

  v_hours_remaining := v_total_service_hours;

  -- Distribute hours into working windows
  WHILE v_hours_remaining > 0 LOOP
    -- Ensure current day is a valid work day
    IF NOT (EXTRACT(dow FROM v_current_ts)::int = ANY (v_work_days)) THEN
      v_current_ts := date_trunc('day', v_current_ts) + INTERVAL '1 day';
      CONTINUE;
    END IF;

    v_day_start := date_trunc('day', v_current_ts) + v_start_time;
    v_day_end := date_trunc('day', v_current_ts) + v_end_time;

    -- If we're before start, jump to start
    IF v_current_ts < v_day_start THEN
      v_current_ts := v_day_start;
    END IF;

    -- If we already passed end, go to next day
    IF v_current_ts >= v_day_end THEN
      v_current_ts := date_trunc('day', v_current_ts) + INTERVAL '1 day';
      CONTINUE;
    END IF;

    -- Remaining work hours available today (subtract full break only if using full day)
    v_remaining_today := EXTRACT(EPOCH FROM (v_day_end - v_current_ts)) / 3600.0;
    IF v_remaining_today >= v_working_hours_per_day THEN
      v_remaining_today := v_working_hours_per_day; -- full-day capacity
    ELSE
      -- Partial day window; estimate break impact negligible
      v_remaining_today := GREATEST(v_remaining_today, 0);
    END IF;

    IF v_hours_remaining <= v_remaining_today THEN
      v_current_ts := v_current_ts + (v_hours_remaining || ' hours')::interval;
      v_hours_remaining := 0;
    ELSE
      v_current_ts := date_trunc('day', v_current_ts) + INTERVAL '1 day';
      v_hours_remaining := v_hours_remaining - v_remaining_today;
      -- next loop will align to next valid work day/time
    END IF;
  END LOOP;

  RETURN v_current_ts;
END;
$function$;