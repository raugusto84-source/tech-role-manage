-- Fix the delivery_date for order ORD-20260203-0760112FZ8 
-- This order has shared_time service so it should be delivered today (2026-02-04)
UPDATE orders 
SET delivery_date = '2026-02-04',
    updated_at = now()
WHERE id = '03963878-55e9-4a22-b855-db60da9e7bbd'
  AND order_number = 'ORD-20260203-0760112FZ8';