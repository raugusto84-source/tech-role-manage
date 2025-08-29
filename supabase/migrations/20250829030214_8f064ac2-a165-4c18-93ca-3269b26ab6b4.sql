-- Fix fiscal transaction validation to exclude collection triggers
DROP TRIGGER IF EXISTS prevent_order_fiscal_withdrawals_trigger ON public.fiscal_withdrawals;

-- Update the validation function to be more specific
CREATE OR REPLACE FUNCTION public.validate_fiscal_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate fiscal accounts for expenses table
  IF TG_TABLE_NAME = 'expenses' AND NEW.account_type = 'fiscal'::account_type THEN
    IF COALESCE(NEW.has_invoice, FALSE) = FALSE OR 
       NEW.invoice_number IS NULL OR 
       TRIM(NEW.invoice_number) = '' THEN
      RAISE EXCEPTION 'Las transacciones fiscales requieren factura y número de factura válido';
    END IF;
  END IF;
  
  -- For incomes table, only validate if specifically marked as requiring invoice
  IF TG_TABLE_NAME = 'incomes' AND NEW.account_type = 'fiscal'::account_type THEN
    -- For order collections, allow fiscal without requiring invoice
    IF NEW.description LIKE '%Cobro orden%' THEN
      RETURN NEW; -- Allow order collections in fiscal accounts
    END IF;
    
    IF NEW.has_invoice = true AND (NEW.invoice_number IS NULL OR TRIM(NEW.invoice_number) = '') THEN
      RAISE EXCEPTION 'Las transacciones fiscales con factura requieren número de factura válido';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers with correct validation
DROP TRIGGER IF EXISTS validate_fiscal_invoice_expenses ON public.expenses;
DROP TRIGGER IF EXISTS validate_fiscal_invoice_incomes ON public.incomes;

CREATE TRIGGER validate_fiscal_invoice_expenses
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_fiscal_invoice();

CREATE TRIGGER validate_fiscal_invoice_incomes
  BEFORE INSERT OR UPDATE ON public.incomes
  FOR EACH ROW EXECUTE FUNCTION public.validate_fiscal_invoice();

-- Create improved audit logging function without reversal_reason dependency
CREATE OR REPLACE FUNCTION public.log_financial_audit_safe(
  p_table_name text,
  p_record_id uuid,
  p_operation_type text,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_change_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.financial_audit_logs (
    table_name,
    record_id,
    operation_type,
    old_data,
    new_data,
    changed_by,
    change_reason
  ) VALUES (
    p_table_name,
    p_record_id,
    p_operation_type,
    p_old_data,
    p_new_data,
    auth.uid(),
    p_change_reason
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE LOG 'Failed to log audit: %', SQLERRM;
END;
$$;

-- Fix timezone issues for time records
CREATE OR REPLACE FUNCTION public.fix_employee_date_timezone()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure work_date uses local timezone, not UTC offset
  IF NEW.work_date IS NOT NULL THEN
    NEW.work_date := NEW.work_date::date;
  END IF;
  
  -- Fix timezone for check times to be consistent with Mexico City time
  IF NEW.check_in_time IS NOT NULL THEN
    NEW.check_in_time := NEW.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City';
  END IF;
  
  IF NEW.check_out_time IS NOT NULL THEN
    NEW.check_out_time := NEW.check_out_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timezone fix trigger
DROP TRIGGER IF EXISTS fix_employee_date_timezone_trigger ON public.time_records;
CREATE TRIGGER fix_employee_date_timezone_trigger
  BEFORE INSERT OR UPDATE ON public.time_records
  FOR EACH ROW EXECUTE FUNCTION public.fix_employee_date_timezone();