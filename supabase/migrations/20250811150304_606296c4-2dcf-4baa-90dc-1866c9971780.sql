-- Test para verificar si el trigger funciona
-- Primero, crear una cotización de prueba con todos los campos requeridos
INSERT INTO quotes (
  quote_number, 
  client_name, 
  client_email, 
  service_description, 
  estimated_amount, 
  status, 
  marketing_channel,
  created_by, 
  assigned_to
) VALUES (
  'COT-TEST-001', 
  'Cliente Test', 
  'cliente@syslag.com', 
  'Servicio de prueba', 
  100.00, 
  'enviada',
  'web', 
  'b2b19633-b699-4a16-950f-b62dce667b8c', 
  'b2b19633-b699-4a16-950f-b62dce667b8c'
);

-- Ahora actualizar el estado a 'aceptada' para activar el trigger
UPDATE quotes 
SET status = 'aceptada', 
    final_decision_date = now()
WHERE quote_number = 'COT-TEST-001';