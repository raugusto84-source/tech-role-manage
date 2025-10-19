-- Actualizar la fecha de entrega al día 21 para las órdenes de Grupo Altozano
UPDATE orders
SET 
  delivery_date = '2025-10-21',
  updated_at = now()
WHERE order_number IN ('ORD-POL-00013', 'ORD-POL-00014')
AND is_policy_order = true;