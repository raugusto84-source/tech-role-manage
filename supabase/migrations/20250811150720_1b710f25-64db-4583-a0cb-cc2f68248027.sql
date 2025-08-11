-- Crear una cotización de prueba para verificar si el trigger funciona ahora
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
  'COT-TEST-FIX', 
  'Cliente', 
  'cliente@syslag.com', 
  'Servicio de prueba después del fix', 
  250.00, 
  'enviada',
  'web', 
  'b2b19633-b699-4a16-950f-b62dce667b8c', 
  'b2b19633-b699-4a16-950f-b62dce667b8c'
);

-- Agregar algunos items a la cotización
INSERT INTO quote_items (
  quote_id,
  service_type_id,
  name,
  description,
  quantity,
  unit_price,
  subtotal,
  vat_rate,
  vat_amount,
  withholding_rate,
  withholding_amount,
  withholding_type,
  total,
  is_custom
) VALUES (
  (SELECT id FROM quotes WHERE quote_number = 'COT-TEST-FIX'),
  'd7840b8e-4e82-4d98-b5d8-3b60a3dbeaec',
  'Servicio de Prueba',
  'Descripción del servicio de prueba',
  1,
  250.00,
  250.00,
  0.00,
  0.00,
  0.00,
  0.00,
  '',
  250.00,
  false
);

-- Ahora aceptar la cotización para activar el trigger
UPDATE quotes 
SET status = 'aceptada', 
    final_decision_date = now()
WHERE quote_number = 'COT-TEST-FIX';