-- Recreate pending_collections view to resolve incompatible column set
DROP VIEW IF EXISTS public.pending_collections CASCADE;

CREATE VIEW public.pending_collections AS
SELECT
  o.id,
  o.order_number,
  c.name AS client_name,
  c.email AS client_email,
  o.estimated_cost,
  o.delivery_date,
  o.status
FROM public.orders o
LEFT JOIN public.clients c ON c.id = o.client_id
WHERE o.status::text = 'finalizada'
  AND COALESCE(o.estimated_cost, 0) > 0;

-- Performance indexes for faster finance queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_incomes_income_date ON public.incomes (income_date);
CREATE INDEX IF NOT EXISTS idx_incomes_account_type ON public.incomes (account_type);
CREATE INDEX IF NOT EXISTS idx_incomes_created_at ON public.incomes (created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_account_type ON public.expenses (account_type);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses (created_at);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.orders (delivery_date);