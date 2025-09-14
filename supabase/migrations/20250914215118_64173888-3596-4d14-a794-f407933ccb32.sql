-- Revert pending_collections to always use the quote's final total saved on orders
DROP VIEW IF EXISTS public.pending_collections CASCADE;

CREATE VIEW public.pending_collections AS
SELECT 
  o.id,
  o.order_number,
  o.client_id,
  c.name AS client_name,
  c.email AS client_email,
  -- Always show the order's saved total (comes from the quote's total with VAT)
  o.estimated_cost AS estimated_cost,
  o.delivery_date,
  o.created_at,
  o.updated_at,
  COALESCE(payments.total_paid, 0) AS total_paid,
  -- Remaining based strictly on the saved total from the quote
  GREATEST(o.estimated_cost - COALESCE(payments.total_paid, 0), 0) AS remaining_balance,
  -- Keep VAT breakdown for reference only (does not affect remaining)
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
  AND COALESCE(payments.total_paid, 0) < o.estimated_cost;

GRANT SELECT ON public.pending_collections TO authenticated;
ALTER VIEW public.pending_collections SET (security_invoker = on);
