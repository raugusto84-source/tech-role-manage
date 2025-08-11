-- Update pending_collections view to include VAT information
DROP VIEW IF EXISTS pending_collections;

CREATE VIEW pending_collections AS
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
  -- Calculate VAT totals from order items
  COALESCE(vat_data.total_vat_amount, 0) as total_vat_amount,
  COALESCE(vat_data.subtotal_without_vat, 0) as subtotal_without_vat,
  COALESCE(vat_data.total_with_vat, 0) as total_with_vat
FROM orders o
JOIN clients c ON o.client_id = c.id
LEFT JOIN (
  SELECT 
    order_id,
    SUM(payment_amount) as total_paid
  FROM order_payments
  GROUP BY order_id
) payments ON o.id = payments.order_id
LEFT JOIN (
  SELECT 
    order_id,
    SUM(vat_amount) as total_vat_amount,
    SUM(subtotal) as subtotal_without_vat,
    SUM(total_amount) as total_with_vat
  FROM order_items
  GROUP BY order_id
) vat_data ON o.id = vat_data.order_id
WHERE o.status = 'terminada'
  AND COALESCE(payments.total_paid, 0) < o.estimated_cost;