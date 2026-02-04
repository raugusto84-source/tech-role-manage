
-- Fix access development orders status to en_proceso (they are past their scheduled dates)
UPDATE orders 
SET status = 'en_proceso',
    updated_at = now()
WHERE source_type = 'development'
  AND status = 'pendiente_actualizacion'
  AND delivery_date <= '2026-02-04';
