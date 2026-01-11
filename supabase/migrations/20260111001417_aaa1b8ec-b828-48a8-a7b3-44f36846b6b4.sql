-- Primero eliminamos todos los pagos duplicados de forma más agresiva
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY development_id, payment_period ORDER BY created_at) as rn
  FROM access_development_payments
)
DELETE FROM access_development_payments 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Ahora eliminamos órdenes duplicadas
WITH order_duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY development_id, scheduled_date ORDER BY created_at) as rn
  FROM access_development_orders
)
DELETE FROM access_development_orders 
WHERE id IN (SELECT id FROM order_duplicates WHERE rn > 1);

-- Crear índice único para prevenir futuros duplicados en pagos
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_period 
ON access_development_payments(development_id, payment_period);

-- Crear índice único para prevenir futuros duplicados en órdenes
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_order_schedule 
ON access_development_orders(development_id, scheduled_date);