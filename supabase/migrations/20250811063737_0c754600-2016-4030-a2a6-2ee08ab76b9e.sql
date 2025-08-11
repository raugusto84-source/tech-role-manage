-- Insertar una orden de prueba para el cliente@syslag.com con estado pendiente_aprobacion
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
  'ORD-CLIENT-' || EXTRACT(EPOCH FROM NOW())::TEXT,
  '022e368e-e5bd-4357-8061-c476be320aff',
  'd8de9ca2-9917-4ce4-828a-a84c1a00d49a',
  'Orden de prueba para cliente@syslag.com - Verificar componente de aprobación del cliente',
  CURRENT_DATE + INTERVAL '3 days',
  2500.00,
  4.0,
  'pendiente_aprobacion'
);