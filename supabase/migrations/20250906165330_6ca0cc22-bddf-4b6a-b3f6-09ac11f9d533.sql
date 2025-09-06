-- Fix order creation error: remove invalid trigger/function inserting into a VIEW
DROP TRIGGER IF EXISTS create_pending_collection_trigger ON public.orders;
DROP FUNCTION IF EXISTS public.create_pending_collection_on_order();

-- Recreate pending_collections VIEW to include orders with saldo pendiente regardless of status (except cancelada)
DROP VIEW IF EXISTS public.pending_collections CASCADE;
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
  COALESCE(payments.total_paid, 0) as total_paid,
  GREATEST(o.estimated_cost - COALESCE(payments.total_paid, 0), 0) as remaining_balance,
  COALESCE(vat_data.total_vat_amount, 0) as total_vat_amount,
  COALESCE(vat_data.subtotal_without_vat, 0) as subtotal_without_vat,
  COALESCE(vat_data.total_with_vat, 0) as total_with_vat
FROM public.orders o
JOIN public.clients c ON o.client_id = c.id
LEFT JOIN (
  SELECT order_id, SUM(payment_amount) as total_paid
  FROM public.order_payments
  GROUP BY order_id
) payments ON o.id = payments.order_id
LEFT JOIN (
  SELECT 
    order_id,
    SUM(vat_amount) as total_vat_amount,
    SUM(subtotal) as subtotal_without_vat,
    SUM(total_amount) as total_with_vat
  FROM public.order_items
  GROUP BY order_id
) vat_data ON o.id = vat_data.order_id
WHERE o.status != 'cancelada' AND COALESCE(payments.total_paid, 0) < o.estimated_cost;

-- Ensure the view can be selected by authenticated users
GRANT SELECT ON public.pending_collections TO authenticated;
ALTER VIEW public.pending_collections SET (security_invoker = on);

-- Add missing main_category_id used by suggest_optimal_fleet()
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS main_category_id uuid REFERENCES public.main_service_categories(id);
CREATE INDEX IF NOT EXISTS idx_service_types_main_category_id ON public.service_types(main_category_id);