-- Actualizar las dos órdenes de póliza recientes con la fecha correcta
UPDATE orders
SET 
  delivery_date = '2025-10-19',
  failure_description = REPLACE(failure_description, '(2025-10-21)', ''),
  updated_at = now()
WHERE order_number IN ('ORD-POL-00013', 'ORD-POL-00014')
AND is_policy_order = true;