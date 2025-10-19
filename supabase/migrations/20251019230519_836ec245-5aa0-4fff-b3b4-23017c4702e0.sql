-- Restaurar las fechas correctas de las órdenes de póliza al martes 21
UPDATE orders
SET 
  delivery_date = '2025-10-21',
  failure_description = CASE 
    WHEN failure_description NOT LIKE '%(2025-10-21)%' 
    THEN CONCAT(failure_description, ' (2025-10-21)')
    ELSE failure_description
  END,
  updated_at = now()
WHERE order_number IN ('ORD-POL-00013', 'ORD-POL-00014')
AND is_policy_order = true;