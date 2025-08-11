-- Limpiar la cotización de prueba
DELETE FROM quote_items WHERE quote_id = (SELECT id FROM quotes WHERE quote_number = 'COT-TEST-FIX');
DELETE FROM quotes WHERE quote_number = 'COT-TEST-FIX';

-- Verificar si hay algún error en la función del trigger modificando temporalmente el nivel de log
-- Primero veamos la función actual
SELECT pg_get_functiondef(pg_proc.oid) as function_definition
FROM pg_proc 
WHERE proname = 'create_order_from_approved_quote';