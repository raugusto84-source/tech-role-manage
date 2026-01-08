
-- Eliminar el pago de diciembre 2025 de Mayagoitia (no debería existir, fecha inicio es 2025-12-31)
DELETE FROM policy_payments 
WHERE id = 'ec45f462-b7fb-4edd-a3dc-da6cef46f6ee';

-- Actualizar el pago de enero 2026 al precio correcto de la póliza ($3,927.99)
UPDATE policy_payments 
SET amount = 3927.99
WHERE id = 'db9a1b07-15cd-4a5d-8526-ce8d5f122db0';

-- También eliminar cualquier notificación pendiente relacionada con el pago de diciembre
DELETE FROM financial_notifications 
WHERE related_id = 'ec45f462-b7fb-4edd-a3dc-da6cef46f6ee';

-- Eliminar de collections_cache si existe
DELETE FROM collections_cache 
WHERE source_id = 'ec45f462-b7fb-4edd-a3dc-da6cef46f6ee';
