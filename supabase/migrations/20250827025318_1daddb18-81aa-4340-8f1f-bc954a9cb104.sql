-- Create generic audit function and attach to key financial tables
CREATE OR REPLACE FUNCTION public.log_financial_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  op text;
  rec_id uuid;
  tbl text := TG_TABLE_NAME;
  reason text := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    op := 'insert';
    rec_id := NEW.id;
    -- capture explicit reasons if present
    reason := COALESCE(NEW.reversal_reason, NEW.description, NULL);
    INSERT INTO public.financial_audit_logs(
      table_name, operation_type, record_id, old_data, new_data, changed_by, change_reason
    ) VALUES (
      tbl, op, rec_id, NULL, to_jsonb(NEW), auth.uid(), reason
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    op := 'update';
    -- Special cases: reversal or status changes
    IF NEW.is_reversed IS TRUE AND COALESCE(OLD.is_reversed, FALSE) IS DISTINCT FROM TRUE THEN
      op := 'reversed';
    END IF;
    -- Expenses withdrawal change
    IF tbl = 'expenses' AND COALESCE(OLD.withdrawal_status,'pendiente') IS DISTINCT FROM COALESCE(NEW.withdrawal_status,'pendiente') THEN
      op := 'withdrawal_' || NEW.withdrawal_status;
    END IF;
    rec_id := NEW.id;
    reason := COALESCE(NEW.reversal_reason, NEW.description, NULL);
    INSERT INTO public.financial_audit_logs(
      table_name, operation_type, record_id, old_data, new_data, changed_by, change_reason
    ) VALUES (
      tbl, op, rec_id, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), reason
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    op := 'delete';
    rec_id := OLD.id;
    reason := COALESCE(OLD.reversal_reason, OLD.description, NULL);
    INSERT INTO public.financial_audit_logs(
      table_name, operation_type, record_id, old_data, new_data, changed_by, change_reason
    ) VALUES (
      tbl, op, rec_id, to_jsonb(OLD), NULL, auth.uid(), reason
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers to incomes, expenses, order_payments
DROP TRIGGER IF EXISTS trg_audit_incomes ON public.incomes;
CREATE TRIGGER trg_audit_incomes
AFTER INSERT OR UPDATE OR DELETE ON public.incomes
FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();

DROP TRIGGER IF EXISTS trg_audit_expenses ON public.expenses;
CREATE TRIGGER trg_audit_expenses
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();

DROP TRIGGER IF EXISTS trg_audit_order_payments ON public.order_payments;
CREATE TRIGGER trg_audit_order_payments
AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();

-- Relax/adjust validation trigger for fiscal operations only where needed
-- Create a safer validator that runs only on INSERT/UPDATE of incomes/expenses and allows setting invoice data
CREATE OR REPLACE FUNCTION public.validate_fiscal_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.account_type = 'fiscal'::account_type THEN
    IF COALESCE(NEW.has_invoice, FALSE) = FALSE OR NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
      RAISE EXCEPTION 'Las transacciones fiscales requieren factura y número de factura válido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure validator is attached appropriately
DROP TRIGGER IF EXISTS trg_validate_fiscal_incomes ON public.incomes;
CREATE TRIGGER trg_validate_fiscal_incomes
BEFORE INSERT OR UPDATE ON public.incomes
FOR EACH ROW EXECUTE FUNCTION public.validate_fiscal_invoice();

DROP TRIGGER IF EXISTS trg_validate_fiscal_expenses ON public.expenses;
CREATE TRIGGER trg_validate_fiscal_expenses
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.validate_fiscal_invoice();