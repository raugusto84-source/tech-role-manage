-- Fix validation trigger to work correctly with fiscal transactions
CREATE OR REPLACE FUNCTION public.validate_fiscal_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
    IF NEW.has_invoice = true AND (NEW.invoice_number IS NULL OR TRIM(NEW.invoice_number) = '') THEN
      RAISE EXCEPTION 'Las transacciones fiscales con factura requieren número de factura válido';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update fiscal_withdrawals to be for purchases, not order collections
-- Add trigger to prevent order collections from creating fiscal withdrawals
CREATE OR REPLACE FUNCTION public.prevent_order_fiscal_withdrawals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent creating fiscal withdrawals for order collections
  IF NEW.description LIKE '%Cobro orden%' THEN
    RAISE EXCEPTION 'Los retiros fiscales son solo para compras con factura, no para cobros de órdenes';
  END IF;
  RETURN NEW;
END;
$function$;

-- Add trigger to fiscal_withdrawals table
DROP TRIGGER IF EXISTS prevent_order_fiscal_withdrawals_trigger ON fiscal_withdrawals;
CREATE TRIGGER prevent_order_fiscal_withdrawals_trigger
  BEFORE INSERT ON fiscal_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_order_fiscal_withdrawals();

-- Fix time zone issues for employee records
-- Update time_records to use proper timezone handling
CREATE OR REPLACE FUNCTION public.fix_employee_date_timezone()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Ensure work_date uses local timezone, not UTC offset
  IF NEW.work_date IS NOT NULL THEN
    NEW.work_date := NEW.work_date::date;
  END IF;
  
  -- Fix timezone for check times to be consistent
  IF NEW.check_in_time IS NOT NULL THEN
    NEW.check_in_time := NEW.check_in_time AT TIME ZONE 'America/Mexico_City';
  END IF;
  
  IF NEW.check_out_time IS NOT NULL THEN
    NEW.check_out_time := NEW.check_out_time AT TIME ZONE 'America/Mexico_City';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add trigger to fix employee date issues
DROP TRIGGER IF EXISTS fix_employee_date_timezone_trigger ON time_records;
CREATE TRIGGER fix_employee_date_timezone_trigger
  BEFORE INSERT OR UPDATE ON time_records
  FOR EACH ROW
  EXECUTE FUNCTION fix_employee_date_timezone();