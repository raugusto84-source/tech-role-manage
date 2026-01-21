-- Clean up pending_collections: mark fully paid orders as 'paid'
UPDATE pending_collections pc
SET status = 'paid', 
    balance = 0,
    collected_at = NOW()
WHERE pc.collection_type = 'order_payment'
AND pc.status = 'pending'
AND EXISTS (
  SELECT 1 FROM order_items oi WHERE oi.order_id = pc.order_id
  GROUP BY oi.order_id
  HAVING COALESCE(SUM(oi.total_amount), 0) <= (
    SELECT COALESCE(SUM(op.payment_amount), 0) 
    FROM order_payments op 
    WHERE op.order_id = pc.order_id
  )
  AND COALESCE(SUM(oi.total_amount), 0) > 0
);

-- Update balance for partially paid orders to reflect actual remaining amount
UPDATE pending_collections pc
SET balance = (
  SELECT GREATEST(0, COALESCE(SUM(oi.total_amount), 0) - COALESCE((
    SELECT SUM(op.payment_amount) 
    FROM order_payments op 
    WHERE op.order_id = pc.order_id
  ), 0))
  FROM order_items oi 
  WHERE oi.order_id = pc.order_id
)
WHERE pc.collection_type = 'order_payment'
AND pc.status = 'pending'
AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = pc.order_id);