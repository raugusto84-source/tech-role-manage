-- Create time tracking system tables

-- Create time_records table for tracking employee check-ins/check-outs
CREATE TABLE IF NOT EXISTS public.time_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_in_location JSONB, -- {lat, lng, address}
  check_out_location JSONB, -- {lat, lng, address}
  total_hours NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out', 'incomplete')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create weekly_reports table for generating time reports
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  regular_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  days_worked INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  report_data JSONB, -- Detailed breakdown by day
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on time_records table
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

-- Create policies for time_records
CREATE POLICY "Users can manage their own time records" 
ON public.time_records 
FOR ALL 
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins and supervisors can view all time records" 
ON public.time_records 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Admins and supervisors can manage all time records" 
ON public.time_records 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

-- Enable RLS on weekly_reports table
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for weekly_reports
CREATE POLICY "Users can view their own weekly reports" 
ON public.weekly_reports 
FOR SELECT 
USING (employee_id = auth.uid());

CREATE POLICY "Admins and supervisors can manage all weekly reports" 
ON public.weekly_reports 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

-- Create function to calculate total hours
CREATE OR REPLACE FUNCTION public.calculate_time_record_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if both check_in and check_out times exist
  IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0;
    NEW.status := 'checked_out';
  ELSIF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NULL THEN
    NEW.status := 'checked_in';
  ELSE
    NEW.status := 'incomplete';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic hour calculation
CREATE TRIGGER calculate_hours_trigger
  BEFORE INSERT OR UPDATE ON public.time_records
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_time_record_hours();

-- Create function to generate weekly reports
CREATE OR REPLACE FUNCTION public.generate_weekly_report(
  p_employee_id UUID,
  p_week_start DATE,
  p_week_end DATE
)
RETURNS UUID AS $$
DECLARE
  report_id UUID;
  total_hrs NUMERIC := 0;
  regular_hrs NUMERIC := 0;
  overtime_hrs NUMERIC := 0;
  days_count INTEGER := 0;
  report_details JSONB := '[]'::jsonb;
  day_record RECORD;
BEGIN
  -- Calculate totals for the week
  SELECT 
    COALESCE(SUM(total_hours), 0),
    COUNT(DISTINCT work_date)
  INTO total_hrs, days_count
  FROM public.time_records
  WHERE employee_id = p_employee_id
    AND work_date BETWEEN p_week_start AND p_week_end
    AND status = 'checked_out';
  
  -- Calculate regular vs overtime (assuming 8 hours per day is regular)
  IF total_hrs <= (days_count * 8) THEN
    regular_hrs := total_hrs;
    overtime_hrs := 0;
  ELSE
    regular_hrs := days_count * 8;
    overtime_hrs := total_hrs - regular_hrs;
  END IF;
  
  -- Build detailed report data
  FOR day_record IN 
    SELECT 
      work_date,
      check_in_time,
      check_out_time,
      total_hours,
      check_in_location,
      check_out_location
    FROM public.time_records
    WHERE employee_id = p_employee_id
      AND work_date BETWEEN p_week_start AND p_week_end
    ORDER BY work_date
  LOOP
    report_details := report_details || jsonb_build_object(
      'date', day_record.work_date,
      'check_in', day_record.check_in_time,
      'check_out', day_record.check_out_time,
      'hours', day_record.total_hours,
      'check_in_location', day_record.check_in_location,
      'check_out_location', day_record.check_out_location
    );
  END LOOP;
  
  -- Insert or update weekly report
  INSERT INTO public.weekly_reports (
    employee_id,
    week_start_date,
    week_end_date,
    total_hours,
    regular_hours,
    overtime_hours,
    days_worked,
    report_data,
    generated_by
  ) VALUES (
    p_employee_id,
    p_week_start,
    p_week_end,
    total_hrs,
    regular_hrs,
    overtime_hrs,
    days_count,
    report_details,
    auth.uid()
  )
  ON CONFLICT (employee_id, week_start_date, week_end_date) 
  DO UPDATE SET
    total_hours = EXCLUDED.total_hours,
    regular_hours = EXCLUDED.regular_hours,
    overtime_hours = EXCLUDED.overtime_hours,
    days_worked = EXCLUDED.days_worked,
    report_data = EXCLUDED.report_data,
    generated_at = now(),
    generated_by = EXCLUDED.generated_by
  RETURNING id INTO report_id;
  
  RETURN report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint for weekly reports
ALTER TABLE public.weekly_reports 
ADD CONSTRAINT unique_employee_week 
UNIQUE (employee_id, week_start_date, week_end_date);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_records_employee_date 
ON public.time_records(employee_id, work_date);

CREATE INDEX IF NOT EXISTS idx_time_records_status 
ON public.time_records(status);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_employee 
ON public.weekly_reports(employee_id);

COMMENT ON TABLE public.time_records IS 'Employee time tracking records with geolocation';
COMMENT ON TABLE public.weekly_reports IS 'Weekly time reports for employees';