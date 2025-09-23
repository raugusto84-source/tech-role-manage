-- Eliminar vista que depende de las columnas de fecha
DROP VIEW IF EXISTS public.vat_summary;

-- Cambiar campos de fecha para incluir hora en las tablas principales
-- Cambiar income_date a timestamp with time zone
ALTER TABLE public.incomes 
ALTER COLUMN income_date TYPE timestamp with time zone 
USING income_date::timestamp with time zone;

-- Cambiar expense_date a timestamp with time zone  
ALTER TABLE public.expenses 
ALTER COLUMN expense_date TYPE timestamp with time zone
USING expense_date::timestamp with time zone;

-- Cambiar payment_date a timestamp with time zone
ALTER TABLE public.order_payments 
ALTER COLUMN payment_date TYPE timestamp with time zone
USING payment_date::timestamp with time zone;

-- Actualizar defaults para usar timestamp actual en lugar de solo fecha
ALTER TABLE public.incomes 
ALTER COLUMN income_date SET DEFAULT now();

ALTER TABLE public.expenses 
ALTER COLUMN expense_date SET DEFAULT now();

ALTER TABLE public.order_payments 
ALTER COLUMN payment_date SET DEFAULT now();

-- Recrear la vista vat_summary (funciona igual porque ya usaba date_trunc)
CREATE VIEW public.vat_summary AS
WITH periods AS (
  SELECT DISTINCT (date_trunc('month'::text, incomes.income_date))::date AS period
  FROM incomes
  WHERE ((incomes.account_type = 'fiscal'::account_type) AND (incomes.vat_amount IS NOT NULL))
  UNION
  SELECT DISTINCT (date_trunc('month'::text, expenses.expense_date))::date AS period
  FROM expenses
  WHERE ((expenses.account_type = 'fiscal'::account_type) AND (expenses.vat_amount IS NOT NULL))
), 
income_vat AS (
  SELECT (date_trunc('month'::text, incomes.income_date))::date AS period,
    sum(COALESCE(incomes.vat_amount, (0)::numeric)) AS vat_collected
  FROM incomes
  WHERE (incomes.account_type = 'fiscal'::account_type)
  GROUP BY (date_trunc('month'::text, incomes.income_date))
), 
expense_vat AS (
  SELECT (date_trunc('month'::text, expenses.expense_date))::date AS period,
    sum(COALESCE(expenses.vat_amount, (0)::numeric)) AS vat_paid
  FROM expenses
  WHERE (expenses.account_type = 'fiscal'::account_type)
  GROUP BY (date_trunc('month'::text, expenses.expense_date))
)
SELECT p.period,
  COALESCE(i.vat_collected, (0)::numeric) AS vat_collected,
  COALESCE(e.vat_paid, (0)::numeric) AS vat_paid,
  (COALESCE(i.vat_collected, (0)::numeric) - COALESCE(e.vat_paid, (0)::numeric)) AS vat_balance
FROM ((periods p
  LEFT JOIN income_vat i ON ((p.period = i.period)))
  LEFT JOIN expense_vat e ON ((p.period = e.period)))
ORDER BY p.period DESC;