-- Crear notificaciones de prueba para verificar el sistema
INSERT INTO financial_notifications (notification_type, title, description, amount, priority)
VALUES 
  ('fiscal_withdrawal', 'Retiro Fiscal Pendiente', 'Hay 3 retiros fiscales pendientes de realizar', 15000.00, 'high'),
  ('loan_overdue', 'Préstamos Vencidos', 'Hay 2 pagos de préstamos vencidos', 5000.00, 'urgent'),
  ('collection_pending', 'Cobranzas Vencidas', 'Hay 5 cobros vencidos pendientes', 25000.00, 'high'),
  ('vat_status', 'IVA a Favor', 'Tienes $8,500.00 de IVA a favor del mes actual', 8500.00, 'normal'),
  ('payroll_unpaid', 'Nóminas Pendientes', 'Hay 1 nómina sin pagar', 12000.00, 'urgent');