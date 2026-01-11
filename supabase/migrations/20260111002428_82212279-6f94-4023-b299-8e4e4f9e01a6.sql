-- Actualizar todos los pagos existentes para que el due_date sea el día 1 del mes
UPDATE access_development_payments 
SET due_date = DATE_TRUNC('month', due_date::date)::date 
WHERE status IN ('pending', 'overdue');