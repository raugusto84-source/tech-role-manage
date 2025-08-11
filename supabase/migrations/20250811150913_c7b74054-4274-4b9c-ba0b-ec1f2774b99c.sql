-- Probar el trigger con una actualización simple
UPDATE quotes 
SET notes = 'Prueba de trigger'
WHERE quote_number = 'COT-2025-0016' AND client_email = 'cliente@syslag.com';