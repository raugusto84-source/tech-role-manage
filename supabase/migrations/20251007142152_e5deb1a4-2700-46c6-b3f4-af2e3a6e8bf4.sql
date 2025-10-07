
-- Fix Security Definer View linter issue by explicitly setting security_invoker = true
-- This ensures views run with the permissions of the invoking user, not the view creator

-- Fix admin_employee_overview view
DROP VIEW IF EXISTS public.admin_employee_overview CASCADE;

CREATE VIEW public.admin_employee_overview
WITH (security_invoker = true)
AS
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
    COALESCE(week_stats.total_hours, 0) as current_week_hours,
    COALESCE(week_stats.days_worked, 0) as current_week_days,
    COALESCE(week_stats.overtime_hours, 0) as current_week_overtime,
    COALESCE(month_stats.total_hours, 0) as current_month_hours,
    COALESCE(month_stats.days_worked, 0) as current_month_days,
    latest_record.check_in_time as last_check_in,
    latest_record.check_out_time as last_check_out,
    latest_record.status as current_status
FROM public.profiles p
LEFT JOIN public.work_schedules ws ON ws.employee_id = p.user_id AND ws.is_active = true
LEFT JOIN (
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
    SELECT DISTINCT ON (employee_id)
        employee_id,
        check_in_time,
        check_out_time,
        status
    FROM public.time_records
    ORDER BY employee_id, work_date DESC, check_in_time DESC
) latest_record ON latest_record.employee_id = p.user_id
WHERE p.role IN ('tecnico', 'vendedor', 'administrador', 'supervisor');

-- Fix technician_service_skills view
DROP VIEW IF EXISTS public.technician_service_skills CASCADE;

CREATE VIEW public.technician_service_skills
WITH (security_invoker = true)
AS
SELECT 
  ts.id,
  ts.technician_id,
  ts.service_type_id,
  ts.skill_level,
  ts.years_experience,
  ts.certifications,
  ts.notes,
  ts.created_at,
  ts.updated_at,
  st.name as service_name,
  st.description as service_description,
  st.category as service_category,
  st.estimated_hours as service_estimated_hours
FROM public.technician_skills ts
INNER JOIN public.service_types st ON ts.service_type_id = st.id
WHERE st.is_active = true AND st.item_type = 'servicio';

-- Fix vat_summary view
DROP VIEW IF EXISTS public.vat_summary CASCADE;

CREATE VIEW public.vat_summary
WITH (security_invoker = true)
AS
WITH periods AS (
  SELECT DISTINCT date_trunc('month', income_date)::date AS period
  FROM public.incomes
  WHERE account_type = 'fiscal' AND vat_amount IS NOT NULL
  UNION
  SELECT DISTINCT date_trunc('month', expense_date)::date AS period
  FROM public.expenses
  WHERE account_type = 'fiscal' AND vat_amount IS NOT NULL
),
income_vat AS (
  SELECT 
    date_trunc('month', income_date)::date AS period,
    SUM(COALESCE(vat_amount, 0)) AS vat_collected
  FROM public.incomes
  WHERE account_type = 'fiscal'
  GROUP BY date_trunc('month', income_date)
),
expense_vat AS (
  SELECT 
    date_trunc('month', expense_date)::date AS period,
    SUM(COALESCE(vat_amount, 0)) AS vat_paid
  FROM public.expenses
  WHERE account_type = 'fiscal'
  GROUP BY date_trunc('month', expense_date)
)
SELECT 
  p.period,
  COALESCE(i.vat_collected, 0) AS vat_collected,
  COALESCE(e.vat_paid, 0) AS vat_paid,
  COALESCE(i.vat_collected, 0) - COALESCE(e.vat_paid, 0) AS vat_balance
FROM periods p
LEFT JOIN income_vat i ON p.period = i.period
LEFT JOIN expense_vat e ON p.period = e.period
ORDER BY p.period DESC;

COMMENT ON VIEW public.admin_employee_overview IS 'Employee overview with security_invoker enabled for proper RLS enforcement';
COMMENT ON VIEW public.technician_service_skills IS 'Technician skills view with security_invoker enabled for proper RLS enforcement';
COMMENT ON VIEW public.vat_summary IS 'VAT summary view with security_invoker enabled for proper RLS enforcement';
