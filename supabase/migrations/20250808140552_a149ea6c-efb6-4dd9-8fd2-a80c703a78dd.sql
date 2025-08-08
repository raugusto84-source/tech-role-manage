-- Add salary and calculation fields to work_schedules table
ALTER TABLE public.work_schedules 
ADD COLUMN monthly_salary numeric DEFAULT 0,
ADD COLUMN overtime_rate_multiplier numeric DEFAULT 1.5;

-- Add a function to calculate weekly hours
CREATE OR REPLACE FUNCTION public.calculate_schedule_weekly_hours(work_days integer[], start_time time, end_time time, break_duration_minutes integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  daily_hours numeric;
  weekly_hours numeric;
BEGIN
  -- Calculate hours per day (end_time - start_time - break)
  daily_hours := EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0 - (break_duration_minutes / 60.0);
  
  -- Multiply by number of work days
  weekly_hours := daily_hours * array_length(work_days, 1);
  
  RETURN GREATEST(weekly_hours, 0); -- Ensure non-negative
END;
$$;