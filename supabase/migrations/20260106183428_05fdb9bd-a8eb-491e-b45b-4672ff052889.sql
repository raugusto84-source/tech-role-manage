-- Actualizar la orden de fraccionamiento existente para que esté en pendiente_aprobacion
UPDATE public.orders 
SET status = 'pendiente_aprobacion', order_category = 'fraccionamientos'
WHERE id = '7282b22f-04ac-4428-8e73-2ec63eeac9c4';