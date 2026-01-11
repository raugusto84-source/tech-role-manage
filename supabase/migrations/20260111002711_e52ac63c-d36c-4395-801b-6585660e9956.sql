-- Insertar los pagos faltantes para todos los desarrollos activos
-- Circuito Domecq (36 meses desde 2025-06-01)
INSERT INTO access_development_payments (development_id, payment_period, due_date, amount, investor_portion, company_portion, is_recovery_period, status)
SELECT 
  '3361ab9b-e1c9-4238-8d24-77919386035b',
  DATE_TRUNC('month', '2025-06-01'::date + (n || ' months')::interval)::date,
  DATE_TRUNC('month', '2025-06-01'::date + (n || ' months')::interval)::date,
  10500.00,
  CASE WHEN n < 8 THEN 10500.00 ELSE 10500.00 * 0.20 END,
  CASE WHEN n < 8 THEN 0 ELSE 10500.00 * 0.80 END,
  n < 8,
  CASE WHEN DATE_TRUNC('month', '2025-06-01'::date + (n || ' months')::interval)::date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
FROM generate_series(0, 35) AS n
ON CONFLICT (development_id, payment_period) DO NOTHING;

-- Circuito Juan Jose Castro (12 meses desde 2025-12-01)
INSERT INTO access_development_payments (development_id, payment_period, due_date, amount, investor_portion, company_portion, is_recovery_period, status)
SELECT 
  'ff70fcca-e975-40a8-998f-511ff1a07ed5',
  DATE_TRUNC('month', '2025-12-01'::date + (n || ' months')::interval)::date,
  DATE_TRUNC('month', '2025-12-01'::date + (n || ' months')::interval)::date,
  8200.00,
  CASE WHEN n < 7 THEN 8200.00 ELSE 8200.00 * 0.20 END,
  CASE WHEN n < 7 THEN 0 ELSE 8200.00 * 0.80 END,
  n < 7,
  CASE WHEN DATE_TRUNC('month', '2025-12-01'::date + (n || ' months')::interval)::date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
FROM generate_series(0, 11) AS n
ON CONFLICT (development_id, payment_period) DO NOTHING;

-- Framboyanes (10 meses desde 2026-01-01)
INSERT INTO access_development_payments (development_id, payment_period, due_date, amount, investor_portion, company_portion, is_recovery_period, status)
SELECT 
  'c2482f34-cb4c-466e-8eaf-59a2524860d8',
  DATE_TRUNC('month', '2026-01-01'::date + (n || ' months')::interval)::date,
  DATE_TRUNC('month', '2026-01-01'::date + (n || ' months')::interval)::date,
  3650.00,
  0,
  3650.00,
  false,
  CASE WHEN DATE_TRUNC('month', '2026-01-01'::date + (n || ' months')::interval)::date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
FROM generate_series(0, 9) AS n
ON CONFLICT (development_id, payment_period) DO NOTHING;