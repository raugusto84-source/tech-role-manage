-- Eliminar y recrear la vista sin security definer
DROP VIEW IF EXISTS public.vat_summary;

-- Crear vista para resumen de IVA basado en incomes y expenses con security invoker
CREATE VIEW public.vat_summary 
WITH (security_invoker = on) AS
WITH periods AS (
  SELECT DISTINCT DATE_TRUNC('month', income_date)::date as period
  FROM public.incomes 
  WHERE account_type = 'fiscal' AND vat_amount IS NOT NULL
  UNION
  SELECT DISTINCT DATE_TRUNC('month', expense_date)::date as period
  FROM public.expenses 
  WHERE account_type = 'fiscal' AND vat_amount IS NOT NULL
),
income_vat AS (
  SELECT 
    DATE_TRUNC('month', income_date)::date as period,
    SUM(COALESCE(vat_amount, 0)) as vat_collected
  FROM public.incomes 
  WHERE account_type = 'fiscal'
  GROUP BY DATE_TRUNC('month', income_date)
),
expense_vat AS (
  SELECT 
    DATE_TRUNC('month', expense_date)::date as period,
    SUM(COALESCE(vat_amount, 0)) as vat_paid
  FROM public.expenses 
  WHERE account_type = 'fiscal'
  GROUP BY DATE_TRUNC('month', expense_date)
)
SELECT 
  p.period,
  COALESCE(i.vat_collected, 0) as vat_collected,
  COALESCE(e.vat_paid, 0) as vat_paid,
  COALESCE(i.vat_collected, 0) - COALESCE(e.vat_paid, 0) as vat_balance
FROM periods p
LEFT JOIN income_vat i ON p.period = i.period
LEFT JOIN expense_vat e ON p.period = e.period
ORDER BY p.period DESC;