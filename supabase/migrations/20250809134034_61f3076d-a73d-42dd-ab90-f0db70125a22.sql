-- Drop the existing view
DROP VIEW IF EXISTS public.pending_collections_with_payments;

-- Create a secure view without SECURITY DEFINER
CREATE VIEW public.pending_collections_with_payments AS
SELECT 
  pc.id,
  pc.order_number,
  pc.client_name,
  pc.client_email,
  pc.estimated_cost,
  pc.delivery_date,
  pc.status,
  COALESCE(SUM(op.payment_amount), 0) as total_paid,
  (pc.estimated_cost - COALESCE(SUM(op.payment_amount), 0)) as remaining_balance
FROM pending_collections pc
LEFT JOIN order_payments op ON pc.order_number = op.order_number
GROUP BY pc.id, pc.order_number, pc.client_name, pc.client_email, pc.estimated_cost, pc.delivery_date, pc.status
HAVING (pc.estimated_cost - COALESCE(SUM(op.payment_amount), 0)) > 0
ORDER BY pc.delivery_date ASC;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.pending_collections_with_payments TO authenticated;