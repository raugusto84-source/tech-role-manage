-- Insertar una orden de prueba con estado pendiente_aprobacion
INSERT INTO public.orders (
  order_number,
  client_id,
  service_type,
  failure_description,
  delivery_date,
  estimated_cost,
  average_service_time,
  status
) VALUES (
  'ORD-TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
  '2c727d06-c9f0-4d30-848a-e1441bed6144',
  'd8de9ca2-9917-4ce4-828a-a84c1a00d49a',
  'Orden de prueba para verificar el componente de aprobación del cliente',
  CURRENT_DATE + INTERVAL '2 days',
  1500.00,
  3.0,
  'pendiente_aprobacion'
);