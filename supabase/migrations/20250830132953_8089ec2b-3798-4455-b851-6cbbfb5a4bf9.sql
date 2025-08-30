-- Fix audit trigger to avoid referencing non-existent columns like reversal_reason on tables such as order_payments
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
    -- Safely capture a reason if present via JSONB to avoid missing column errors
    reason := COALESCE((to_jsonb(NEW)->>'reversal_reason'), (to_jsonb(NEW)->>'description'), NULL);
    INSERT INTO public.financial_audit_logs(
      table_name, operation_type, record_id, old_data, new_data, changed_by, change_reason
    ) VALUES (
      tbl, op, rec_id, NULL, to_jsonb(NEW), auth.uid(), reason
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    op := 'update';
    -- Special cases: reversal or status changes where applicable
    IF (to_jsonb(NEW)->>'is_reversed')::boolean IS TRUE AND COALESCE((to_jsonb(OLD)->>'is_reversed')::boolean, FALSE) IS DISTINCT FROM TRUE THEN
      op := 'reversed';
    END IF;
    IF tbl = 'expenses' AND COALESCE((to_jsonb(OLD)->>'withdrawal_status'), 'pendiente') IS DISTINCT FROM COALESCE((to_jsonb(NEW)->>'withdrawal_status'), 'pendiente') THEN
      op := 'withdrawal_' || (to_jsonb(NEW)->>'withdrawal_status');
    END IF;
    rec_id := NEW.id;
    reason := COALESCE((to_jsonb(NEW)->>'reversal_reason'), (to_jsonb(NEW)->>'description'), NULL);
    INSERT INTO public.financial_audit_logs(
      table_name, operation_type, record_id, old_data, new_data, changed_by, change_reason
    ) VALUES (
      tbl, op, rec_id, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), reason
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    op := 'delete';
    rec_id := OLD.id;
    reason := COALESCE((to_jsonb(OLD)->>'reversal_reason'), (to_jsonb(OLD)->>'description'), NULL);
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

-- Recreate triggers to ensure they use the updated function (idempotent)
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