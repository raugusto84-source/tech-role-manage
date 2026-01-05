
-- Insert missing pending_collections for finalized orders that don't have one yet
INSERT INTO pending_collections (
  order_id,
  order_number,
  client_name,
  client_email,
  amount,
  balance,
  collection_type,
  status,
  due_date,
  notes
)
SELECT 
  o.id,
  o.order_number,
  c.name,
  c.email,
  COALESCE((SELECT SUM(total_amount) FROM order_items WHERE order_id = o.id), 0),
  COALESCE((SELECT SUM(total_amount) FROM order_items WHERE order_id = o.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM order_payments WHERE order_id = o.id), 0),
  'order_payment',
  'pending',
  CURRENT_DATE + INTERVAL '7 days',
  'Cobranza orden #' || o.order_number
FROM orders o
LEFT JOIN clients c ON o.client_id = c.id
WHERE o.status = 'finalizada'
  AND o.deleted_at IS NULL
  AND o.skip_payment IS NOT TRUE
  AND o.id NOT IN (SELECT order_id FROM pending_collections WHERE order_id IS NOT NULL)
  AND COALESCE((SELECT SUM(total_amount) FROM order_items WHERE order_id = o.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM order_payments WHERE order_id = o.id), 0) > 0
