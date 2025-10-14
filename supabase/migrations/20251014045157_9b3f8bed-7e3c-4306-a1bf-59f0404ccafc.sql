-- Update specific orders to 'en_proceso' status
UPDATE public.orders 
SET 
  status = 'en_proceso'::order_status,
  updated_at = now()
WHERE order_number IN (
  'ORD-2025-0001',
  'ORD-2025-0003', 
  'ORD-2025-0004',
  'ORD-2025-0005',
  'ORD-2025-0006'
);

-- Log the status changes
INSERT INTO public.order_status_logs (
  order_id,
  previous_status,
  new_status,
  changed_by,
  notes
)
SELECT 
  o.id,
  o.status,
  'en_proceso'::order_status,
  auth.uid(),
  'Cambio manual de estado por administrador'
FROM public.orders o
WHERE o.order_number IN (
  'ORD-2025-0001',
  'ORD-2025-0003',
  'ORD-2025-0004', 
  'ORD-2025-0005',
  'ORD-2025-0006'
)
AND o.status != 'en_proceso'::order_status;