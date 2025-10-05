-- Eliminar notificaciones de cobros pendientes con monto 0
DELETE FROM pending_collections
WHERE amount = 0 AND status = 'pending';