-- Ensure pending_collections shows and uses VAT-inclusive totals for balances
DROP VIEW IF EXISTS public.pending_collections CASCADE;

CREATE VIEW public.pending_collections AS
SELECT 
  o.id,
  o.order_number,
  o.client_id,
  c.name AS client_name,
  c.email AS client_email,
  -- Use VAT-inclusive total when available
  COALESCE(vat_data.total_with_vat, o.estimated_cost) AS estimated_cost,
  o.delivery_date,
  o.created_at,
  o.updated_at,
  COALESCE(payments.total_paid, 0) AS total_paid,
  -- Remaining balance must be based on total WITH VAT
  GREATEST(COALESCE(vat_data.total_with_vat, o.estimated_cost) - COALESCE(payments.total_paid, 0), 0) AS remaining_balance,
  -- Expose detailed VAT breakdown for UI
  COALESCE(vat_data.total_vat_amount, 0) AS total_vat_amount,
  COALESCE(vat_data.subtotal_without_vat, 0) AS subtotal_without_vat,
  COALESCE(vat_data.total_with_vat, 0) AS total_with_vat
FROM public.orders o
JOIN public.clients c ON o.client_id = c.id
LEFT JOIN (
  SELECT order_id, SUM(payment_amount) AS total_paid
  FROM public.order_payments
  GROUP BY order_id
) payments ON o.id = payments.order_id
LEFT JOIN (
  SELECT 
    order_id,
    SUM(vat_amount) AS total_vat_amount,
    SUM(subtotal) AS subtotal_without_vat,
    SUM(total_amount) AS total_with_vat
  FROM public.order_items
  GROUP BY order_id
) vat_data ON o.id = vat_data.order_id
WHERE o.status != 'cancelada'
  AND COALESCE(payments.total_paid, 0) < COALESCE(vat_data.total_with_vat, o.estimated_cost);

GRANT SELECT ON public.pending_collections TO authenticated;
ALTER VIEW public.pending_collections SET (security_invoker = on);
