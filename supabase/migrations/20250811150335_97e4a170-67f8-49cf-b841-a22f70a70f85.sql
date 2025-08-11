-- Limpiar la cotización de prueba
DELETE FROM quotes WHERE quote_number = 'COT-TEST-001';

-- Verificar si el trigger está habilitado
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_create_order_from_approved_quote';