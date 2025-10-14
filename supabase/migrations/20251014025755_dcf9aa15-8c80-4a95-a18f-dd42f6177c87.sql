-- Soft delete orders ORD-POL-00001 and ORD-POL-00002
UPDATE public.orders 
SET 
  deleted_at = now(),
  deletion_reason = 'Eliminadas porque no existen pólizas registradas en el sistema'
WHERE order_number IN ('ORD-POL-00001', 'ORD-POL-00002')
AND deleted_at IS NULL;