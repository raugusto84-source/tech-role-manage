-- Add approved totals to orders and update pending_collections to use them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'approved_total'
  ) THEN
    ALTER TABLE public.orders 
      ADD COLUMN approved_subtotal numeric,
      ADD COLUMN approved_vat_amount numeric,
      ADD COLUMN approved_total numeric;
  END IF;
END $$;

-- Recreate view to prioritize approved totals
DROP VIEW IF EXISTS public.pending_collections;
CREATE VIEW public.pending_collections AS
SELECT 
    o.id,
    o.order_number,
    o.client_id,
    c.name as client_name,
    c.email as client_email,
    o.created_at,
    o.delivery_date,
    o.updated_at,
    
    -- Prefer approved values, fallback to item totals, then estimated
    COALESCE(o.approved_subtotal, item_totals.subtotal_amount, 
             CASE WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.86 ELSE 0 END) AS subtotal_without_vat,
    COALESCE(o.approved_vat_amount, item_totals.vat_amount, 
             CASE WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.14 ELSE 0 END) AS total_vat_amount,
    COALESCE(o.approved_total, item_totals.total_amount, o.estimated_cost, 0) AS estimated_cost,
    COALESCE(o.approved_total, item_totals.total_amount, o.estimated_cost, 0) AS total_with_vat,
    
    COALESCE(payments.total_paid, 0) as total_paid,
    GREATEST(COALESCE(o.approved_total, item_totals.total_amount, o.estimated_cost, 0) - COALESCE(payments.total_paid, 0), 0) as remaining_balance
FROM public.orders o
JOIN public.clients c ON c.id = o.client_id
LEFT JOIN (
    SELECT 
        oi.order_id,
        SUM(oi.subtotal) as subtotal_amount,
        SUM(oi.vat_amount) as vat_amount,
        SUM(oi.total_amount) as total_amount
    FROM public.order_items oi
    GROUP BY oi.order_id
) item_totals ON item_totals.order_id = o.id
LEFT JOIN (
    SELECT 
        op.order_id,
        SUM(op.payment_amount) as total_paid
    FROM public.order_payments op
    GROUP BY op.order_id
) payments ON payments.order_id = o.id
WHERE o.status NOT IN ('cancelada')
AND (
  (o.status = 'finalizada' AND COALESCE(o.approved_total, item_totals.total_amount, o.estimated_cost, 0) > COALESCE(payments.total_paid, 0))
  OR
  (o.status != 'finalizada' AND (COALESCE(o.approved_total, item_totals.total_amount, o.estimated_cost, 0)) > 0)
);

-- Optional: grant select to authenticated
GRANT SELECT ON public.pending_collections TO authenticated;