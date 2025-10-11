-- ============================================
-- MEJORAS AL SISTEMA DE FINANZAS (Corregida)
-- ============================================

-- 1. Agregar remaining_amount a loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0;

-- Inicializar remaining_amount con el monto original para préstamos existentes
UPDATE loans 
SET remaining_amount = amount 
WHERE remaining_amount IS NULL OR remaining_amount = 0;

-- 2. Agregar loan_id a incomes para relación directa
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS loan_id UUID REFERENCES loans(id) ON DELETE CASCADE;

-- 3. Agregar purchase_id a expenses para relación directa con compras
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE;

-- 4. Crear tabla de cache de cobranza
CREATE TABLE IF NOT EXISTS collections_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('order', 'policy')),
  source_id UUID NOT NULL,
  amount_pending NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  is_overdue BOOLEAN DEFAULT false,
  client_name TEXT,
  client_id UUID,
  order_number TEXT,
  policy_number TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para collections_cache
CREATE INDEX IF NOT EXISTS idx_collections_cache_source ON collections_cache(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_collections_cache_overdue ON collections_cache(is_overdue) WHERE is_overdue = true;
CREATE INDEX IF NOT EXISTS idx_collections_cache_client ON collections_cache(client_id);

-- 5. Crear tabla de notificaciones financieras
CREATE TABLE IF NOT EXISTS financial_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('fiscal_withdrawal', 'loan_overdue', 'payroll_unpaid', 'collection_pending', 'vat_status')),
  title TEXT NOT NULL,
  description TEXT,
  related_id UUID,
  amount NUMERIC,
  is_read BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Índices para financial_notifications
CREATE INDEX IF NOT EXISTS idx_financial_notifications_unread ON financial_notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_financial_notifications_type ON financial_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_financial_notifications_created ON financial_notifications(created_at DESC);

-- 6. Actualizar funciones de generación de números a 5 dígitos

-- Función para generar número de expense (5 dígitos)
CREATE OR REPLACE FUNCTION generate_expense_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_year TEXT;
  max_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(expense_number FROM 'EXP-' || current_year || '-(.*)') AS INTEGER)), 0) + 1
  INTO max_number
  FROM expenses
  WHERE expense_number LIKE 'EXP-' || current_year || '-%';
  
  RETURN 'EXP-' || current_year || '-' || LPAD(max_number::TEXT, 5, '0');
END;
$$;

-- Función para generar número de income (5 dígitos)
CREATE OR REPLACE FUNCTION generate_income_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_year TEXT;
  max_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(income_number FROM 'INC-' || current_year || '-(.*)') AS INTEGER)), 0) + 1
  INTO max_number
  FROM incomes
  WHERE income_number LIKE 'INC-' || current_year || '-%';
  
  RETURN 'INC-' || current_year || '-' || LPAD(max_number::TEXT, 5, '0');
END;
$$;

-- Actualizar generate_loan_number a 5 dígitos
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN 'LOAN-' || LPAD(NEXTVAL('loans_seq')::TEXT, 5, '0');
END;
$$;

-- 7. Agregar constraints para prevenir duplicados

-- Evitar duplicados de préstamos por número
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_loan_number ON loans(loan_number);

-- Evitar duplicados de nóminas por período y empleado
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payroll_period 
ON payrolls(employee_name, period_month, period_year)
WHERE status != 'cancelado';

-- 8. RLS Policies para collections_cache
ALTER TABLE collections_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view collections cache"
ON collections_cache FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text, 'supervisor'::text]));

CREATE POLICY "Staff can manage collections cache"
ON collections_cache FOR ALL
USING (get_current_user_role() = 'administrador'::text);

-- 9. RLS Policies para financial_notifications
ALTER TABLE financial_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view financial notifications"
ON financial_notifications FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text, 'supervisor'::text]));

CREATE POLICY "Staff can manage financial notifications"
ON financial_notifications FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text]));

-- 10. Trigger para actualizar remaining_amount en loans al pagar
CREATE OR REPLACE FUNCTION update_loan_remaining_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  total_paid NUMERIC;
  loan_amount NUMERIC;
BEGIN
  -- Solo procesar cuando el pago cambia a 'pagado'
  IF NEW.payment_status = 'pagado' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'pagado') THEN
    -- Obtener el monto total del préstamo
    SELECT amount INTO loan_amount FROM loans WHERE id = NEW.loan_id;
    
    -- Calcular total pagado hasta ahora
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM loan_payments
    WHERE loan_id = NEW.loan_id AND payment_status = 'pagado';
    
    -- Actualizar remaining_amount del préstamo
    UPDATE loans
    SET 
      remaining_amount = GREATEST(loan_amount - total_paid, 0),
      status = CASE 
        WHEN (loan_amount - total_paid) <= 0 THEN 'pagado'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.loan_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_update_loan_remaining ON loan_payments;
CREATE TRIGGER trigger_update_loan_remaining
AFTER UPDATE ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION update_loan_remaining_amount();

-- 11. Función helper para log de operaciones financieras
CREATE OR REPLACE FUNCTION log_financial_operation(
  p_table_name TEXT,
  p_record_id UUID,
  p_operation_type TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_account_type TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO financial_history (
    table_name,
    record_id,
    operation_type,
    amount,
    operation_description,
    account_type,
    performed_by,
    record_data
  ) VALUES (
    p_table_name,
    p_record_id,
    p_operation_type,
    p_amount,
    p_description,
    p_account_type,
    auth.uid(),
    '{}'::jsonb
  );
END;
$$;