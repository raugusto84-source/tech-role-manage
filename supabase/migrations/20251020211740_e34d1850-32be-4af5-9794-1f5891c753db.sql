
-- Insertar registro de cobranza pendiente para ORD-2025-0020
INSERT INTO public.pending_collections (
  order_id,
  order_number,
  client_name,
  client_email,
  amount,
  balance,
  collection_type,
  status,
  due_date,
  created_at,
  updated_at
)
SELECT 
  o.id,
  o.order_number,
  c.name,
  c.email,
  120.00, -- Total de la orden (2 servicios x $60)
  120.00, -- Balance pendiente (no hay pagos)
  'order',
  'pending',
  COALESCE(o.delivery_date, CURRENT_DATE),
  NOW(),
  NOW()
FROM orders o
JOIN clients c ON o.client_id = c.id
WHERE o.order_number = 'ORD-2025-0020'
  AND NOT EXISTS (
    SELECT 1 FROM pending_collections pc 
    WHERE pc.order_id = o.id
  );
