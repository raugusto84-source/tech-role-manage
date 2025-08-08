-- Eliminar la tabla vat_management ya que usaremos los campos IVA de incomes y expenses
DROP TABLE IF EXISTS public.vat_management;
DROP VIEW IF EXISTS public.vat_summary;

-- Crear vista para resumen de IVA basado en incomes y expenses
CREATE VIEW public.vat_summary AS
SELECT 
  DATE_TRUNC('month', COALESCE(i.income_date, e.expense_date))::date as period,
  SUM(COALESCE(i.vat_amount, 0)) as vat_collected,
  SUM(COALESCE(e.vat_amount, 0)) as vat_paid,
  SUM(COALESCE(i.vat_amount, 0)) - SUM(COALESCE(e.vat_amount, 0)) as vat_balance
FROM (
  SELECT income_date, vat_amount FROM public.incomes WHERE account_type = 'fiscal' AND vat_amount > 0
  UNION ALL
  SELECT NULL as income_date, NULL as vat_amount WHERE 1=0
) i
FULL OUTER JOIN (
  SELECT expense_date, vat_amount FROM public.expenses WHERE account_type = 'fiscal' AND vat_amount > 0
  UNION ALL  
  SELECT NULL as expense_date, NULL as vat_amount WHERE 1=0
) e ON DATE_TRUNC('month', i.income_date) = DATE_TRUNC('month', e.expense_date)
WHERE COALESCE(i.income_date, e.expense_date) IS NOT NULL
GROUP BY DATE_TRUNC('month', COALESCE(i.income_date, e.expense_date))
ORDER BY period DESC;