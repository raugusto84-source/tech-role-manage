-- Mover un día adelante las órdenes de póliza creadas hoy
UPDATE orders 
SET delivery_date = delivery_date + INTERVAL '1 day',
    updated_at = now()
WHERE is_policy_order = true 
  AND order_number IN (
    'ORD-POL-00003',
    'ORD-POL-00004', 
    'ORD-POL-00005',
    'ORD-POL-00006',
    'ORD-POL-00007',
    'ORD-POL-00008',
    'ORD-POL-00009',
    'ORD-POL-00010',
    'ORD-POL-00011',
    'ORD-POL-00012'
  );