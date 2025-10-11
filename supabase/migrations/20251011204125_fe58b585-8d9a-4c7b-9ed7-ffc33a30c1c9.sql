-- Eliminar las notificaciones de prueba
DELETE FROM financial_notifications 
WHERE title IN (
  'Retiro Fiscal Pendiente',
  'Préstamos Vencidos',
  'Cobranzas Vencidas',
  'IVA a Favor',
  'Nóminas Pendientes'
);