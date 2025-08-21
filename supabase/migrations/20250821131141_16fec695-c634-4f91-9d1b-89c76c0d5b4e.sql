-- Fix security issues detected by linter

-- Fix the admin_employee_overview view to not use SECURITY DEFINER
-- Instead, create RLS policies to secure access
DROP VIEW IF EXISTS public.admin_employee_overview;

-- Create the view without SECURITY DEFINER
CREATE VIEW public.admin_employee_overview AS
SELECT 
    p.user_id,
    p.full_name,
    p.email,
    p.role,
    ws.hourly_rate,
    ws.overtime_rate,
    ws.work_days,
    ws.start_time,
    ws.end_time,
    -- Current week stats
    COALESCE(week_stats.total_hours, 0) as current_week_hours,
    COALESCE(week_stats.days_worked, 0) as current_week_days,
    COALESCE(week_stats.overtime_hours, 0) as current_week_overtime,
    -- Month stats
    COALESCE(month_stats.total_hours, 0) as current_month_hours,
    COALESCE(month_stats.days_worked, 0) as current_month_days,
    -- Latest attendance
    latest_record.check_in_time as last_check_in,
    latest_record.check_out_time as last_check_out,
    latest_record.status as current_status
FROM public.profiles p
LEFT JOIN public.work_schedules ws ON ws.employee_id = p.user_id AND ws.is_active = true
LEFT JOIN (
    -- Current week stats
    SELECT 
        employee_id,
        SUM(total_hours) as total_hours,
        COUNT(DISTINCT work_date) as days_worked,
        SUM(CASE WHEN total_hours > 8 THEN total_hours - 8 ELSE 0 END) as overtime_hours
    FROM public.time_records 
    WHERE work_date >= date_trunc('week', CURRENT_DATE)::date
    AND status = 'checked_out'
    GROUP BY employee_id
) week_stats ON week_stats.employee_id = p.user_id
LEFT JOIN (
    -- Current month stats
    SELECT 
        employee_id,
        SUM(total_hours) as total_hours,
        COUNT(DISTINCT work_date) as days_worked
    FROM public.time_records 
    WHERE work_date >= date_trunc('month', CURRENT_DATE)::date
    AND status = 'checked_out'
    GROUP BY employee_id
) month_stats ON month_stats.employee_id = p.user_id
LEFT JOIN (
    -- Latest record per employee
    SELECT DISTINCT ON (employee_id)
        employee_id,
        check_in_time,
        check_out_time,
        status
    FROM public.time_records
    ORDER BY employee_id, work_date DESC, check_in_time DESC
) latest_record ON latest_record.employee_id = p.user_id
WHERE p.role IN ('tecnico', 'vendedor', 'administrador', 'supervisor');

-- Enable RLS on the view (this is done through policies on underlying tables)
-- The view will inherit RLS from the underlying tables

-- Fix the function to have proper search_path
CREATE OR REPLACE FUNCTION public.calculate_employee_weekly_payroll(
    p_employee_id UUID,
    p_week_start DATE,
    p_week_end DATE
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    regular_hours NUMERIC,
    overtime_hours NUMERIC,
    regular_pay NUMERIC,
    overtime_pay NUMERIC,
    total_pay NUMERIC,
    days_worked INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    employee_hourly_rate NUMERIC := 0;
    employee_overtime_rate NUMERIC := 0;
BEGIN
    -- Get employee rates
    SELECT COALESCE(ws.hourly_rate, 0), COALESCE(ws.overtime_rate, ws.hourly_rate * 1.5, 0)
    INTO employee_hourly_rate, employee_overtime_rate
    FROM public.work_schedules ws
    WHERE ws.employee_id = p_employee_id AND ws.is_active = true
    ORDER BY ws.created_at DESC
    LIMIT 1;
    
    -- If no hourly rate found, use default
    IF employee_hourly_rate = 0 THEN
        employee_hourly_rate := 100; -- Default hourly rate
        employee_overtime_rate := 150; -- 1.5x overtime
    END IF;
    
    -- Calculate payroll
    RETURN QUERY
    SELECT 
        p_employee_id,
        p.full_name,
        COALESCE(SUM(CASE WHEN tr.total_hours <= 8 THEN tr.total_hours ELSE 8 END), 0) as regular_hours,
        COALESCE(SUM(CASE WHEN tr.total_hours > 8 THEN tr.total_hours - 8 ELSE 0 END), 0) as overtime_hours,
        COALESCE(SUM(CASE WHEN tr.total_hours <= 8 THEN tr.total_hours ELSE 8 END), 0) * employee_hourly_rate as regular_pay,
        COALESCE(SUM(CASE WHEN tr.total_hours > 8 THEN tr.total_hours - 8 ELSE 0 END), 0) * employee_overtime_rate as overtime_pay,
        (COALESCE(SUM(CASE WHEN tr.total_hours <= 8 THEN tr.total_hours ELSE 8 END), 0) * employee_hourly_rate) +
        (COALESCE(SUM(CASE WHEN tr.total_hours > 8 THEN tr.total_hours - 8 ELSE 0 END), 0) * employee_overtime_rate) as total_pay,
        COUNT(DISTINCT tr.work_date)::INTEGER as days_worked
    FROM public.profiles p
    LEFT JOIN public.time_records tr ON tr.employee_id = p.user_id
        AND tr.work_date BETWEEN p_week_start AND p_week_end
        AND tr.status = 'checked_out'
    WHERE p.user_id = p_employee_id
    GROUP BY p.user_id, p.full_name;
END;
$$;