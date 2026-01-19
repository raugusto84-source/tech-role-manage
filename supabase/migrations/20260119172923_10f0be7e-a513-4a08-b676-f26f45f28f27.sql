-- Corregir orden de Misol para que sea hoy
UPDATE orders SET delivery_date = '2026-01-19' 
WHERE id = '8214adba-ae43-4fb4-bd36-e0f12865e13b';

-- Corregir órdenes de pólizas que se generaron una semana adelante
UPDATE orders SET delivery_date = '2026-01-19' 
WHERE id IN (
  'b3ea8794-2504-4dad-98db-9368bc5599c7',  -- CASTEN
  '026d6413-3b70-4a73-a68d-6789c4fcbed0',  -- HOTEL POSADA
  'fbc70729-574f-4a37-a2f6-2e3bb75228dc'   -- Mayagoitia
);