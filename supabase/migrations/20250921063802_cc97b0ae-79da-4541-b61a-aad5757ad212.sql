-- Manually create reward transactions for existing finalized orders
-- Calculate and insert cashback transactions directly

INSERT INTO public.reward_transactions (
  client_id,
  transaction_type,
  amount,
  description,
  order_id,
  expires_at
)
SELECT 
  o.client_id,
  'earned',
  -- Calculate 5% cashback on services, 1% on articles
  COALESCE(
    (SELECT SUM(CASE 
      WHEN oi.item_type = 'servicio' THEN oi.total_amount * 0.05
      WHEN oi.item_type = 'articulo' THEN oi.total_amount * 0.01
      ELSE 0
    END)
    FROM order_items oi 
    WHERE oi.order_id = o.id), 0
  ),
  'Cashback por orden #' || o.order_number,
  o.id,
  now() + INTERVAL '6 months'
FROM orders o
JOIN client_rewards cr ON cr.client_id = o.client_id
WHERE o.status = 'finalizada'
  AND cr.email_validated = true
  AND cr.whatsapp_validated = true  
  AND cr.registration_source = 'www.login.syslag.com'
  AND NOT EXISTS (
    SELECT 1 FROM reward_transactions rt 
    WHERE rt.order_id = o.id AND rt.transaction_type = 'earned'
  )
  AND (
    SELECT COALESCE(SUM(CASE 
      WHEN oi.item_type = 'servicio' THEN oi.total_amount * 0.05
      WHEN oi.item_type = 'articulo' THEN oi.total_amount * 0.01
      ELSE 0
    END), 0)
    FROM order_items oi 
    WHERE oi.order_id = o.id
  ) > 0;

-- Update client_rewards total_cashback
UPDATE public.client_rewards 
SET 
  total_cashback = COALESCE(
    (SELECT SUM(rt.amount) 
     FROM reward_transactions rt 
     WHERE rt.client_id = client_rewards.client_id 
       AND rt.transaction_type IN ('earned', 'referral_bonus')
       AND (rt.expires_at IS NULL OR rt.expires_at > now())), 
    0
  ),
  updated_at = now()
WHERE client_id IN (
  SELECT DISTINCT o.client_id 
  FROM orders o 
  WHERE o.status = 'finalizada'
);