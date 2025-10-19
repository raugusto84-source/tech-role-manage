-- Actualizar tanto delivery_date como estimated_delivery_date al día 21
UPDATE orders
SET 
  delivery_date = '2025-10-21',
  estimated_delivery_date = '2025-10-21 23:59:59+00',
  updated_at = now()
WHERE order_number IN ('ORD-POL-00013', 'ORD-POL-00014')
AND is_policy_order = true;