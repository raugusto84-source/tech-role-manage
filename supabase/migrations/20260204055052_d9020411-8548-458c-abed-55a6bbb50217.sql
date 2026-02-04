-- Fix the delivery_date for order ORD-20260203-078782BOOW
-- This order was incorrectly scheduled for 2026-02-20 due to workload calculation bug
-- It should be scheduled for today (2026-02-04) or the next available slot

UPDATE orders 
SET delivery_date = '2026-02-04',
    updated_at = now()
WHERE id = '3c4f0211-6931-49e4-b39f-afd118ecde53'
  AND order_number = 'ORD-20260203-078782BOOW';