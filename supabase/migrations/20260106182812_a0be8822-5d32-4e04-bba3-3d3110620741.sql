-- Agregar campo service_category directamente a las órdenes para categorización independiente
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_category text DEFAULT 'sistemas';

-- Actualizar la orden 0002 a seguridad
UPDATE public.orders 
SET order_category = 'seguridad' 
WHERE order_number = 'ORD-2026-0002';

-- Agregar comentario para documentar
COMMENT ON COLUMN public.orders.order_category IS 'Categoría de la orden: sistemas, seguridad, o fraccionamientos (se detecta automáticamente si está en access_development_orders)';