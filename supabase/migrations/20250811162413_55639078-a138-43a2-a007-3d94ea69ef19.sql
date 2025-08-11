-- Drop existing view first
DROP VIEW IF EXISTS public.pending_collections;
DROP VIEW IF EXISTS public.pending_collections_with_payments;

-- Create a view for orders that are finished and need collection
CREATE VIEW public.pending_collections AS
SELECT 
  o.id,
  o.order_number,
  o.client_id,
  c.name as client_name,
  c.email as client_email,
  o.estimated_cost,
  o.delivery_date,
  o.created_at,
  o.updated_at,
  COALESCE(SUM(op.payment_amount), 0) as total_paid,
  GREATEST(o.estimated_cost - COALESCE(SUM(op.payment_amount), 0), 0) as remaining_balance
FROM public.orders o
JOIN public.clients c ON c.id = o.client_id
LEFT JOIN public.order_payments op ON op.order_id = o.id
WHERE o.status = 'finalizada'
  AND o.estimated_cost > 0
GROUP BY o.id, o.order_number, o.client_id, c.name, c.email, o.estimated_cost, o.delivery_date, o.created_at, o.updated_at
HAVING GREATEST(o.estimated_cost - COALESCE(SUM(op.payment_amount), 0), 0) > 0
ORDER BY o.delivery_date ASC;

-- Grant permissions to view
GRANT SELECT ON public.pending_collections TO authenticated;