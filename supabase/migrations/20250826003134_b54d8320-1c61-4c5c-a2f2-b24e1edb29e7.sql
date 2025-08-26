-- Fix fiscal transaction validation
DROP TRIGGER IF EXISTS validate_fiscal_invoice_trigger ON expenses;
DROP TRIGGER IF EXISTS validate_fiscal_invoice_trigger ON incomes;

-- Create improved validation trigger for expenses
CREATE OR REPLACE FUNCTION public.validate_fiscal_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Si es cuenta fiscal, debe tener factura y número de factura
  IF NEW.account_type = 'fiscal' THEN
    IF NEW.has_invoice = false OR NEW.invoice_number IS NULL OR trim(NEW.invoice_number) = '' THEN
      RAISE EXCEPTION 'Las transacciones fiscales requieren factura y número de factura válido';
    END IF;
  END IF;
  
  -- Si no es fiscal, no debe tener número de factura
  IF NEW.account_type = 'no_fiscal' AND NEW.has_invoice = true THEN
    RAISE EXCEPTION 'Las transacciones no fiscales no pueden tener factura';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply validation to both tables
CREATE TRIGGER validate_fiscal_invoice_trigger
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION validate_fiscal_invoice();

CREATE TRIGGER validate_fiscal_invoice_trigger_incomes
  BEFORE INSERT OR UPDATE ON incomes
  FOR EACH ROW EXECUTE FUNCTION validate_fiscal_invoice();

-- Fix expense number uniqueness issue by making it auto-generated
CREATE OR REPLACE FUNCTION public.generate_expense_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  max_expense_num INTEGER;
  new_expense_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the highest expense number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(expense_number FROM 'EXP-' || current_year || '-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_expense_num
  FROM public.expenses
  WHERE expense_number LIKE 'EXP-' || current_year || '-%';
  
  new_expense_number := 'EXP-' || current_year || '-' || LPAD(max_expense_num::TEXT, 4, '0');
  
  RETURN new_expense_number;
END;
$function$;

-- Create trigger to auto-generate expense numbers
CREATE OR REPLACE FUNCTION public.handle_new_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.expense_number IS NULL OR NEW.expense_number = '' THEN
    NEW.expense_number := public.generate_expense_number();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS handle_new_expense_trigger ON expenses;
CREATE TRIGGER handle_new_expense_trigger
  BEFORE INSERT ON expenses
  FOR EACH ROW EXECUTE FUNCTION handle_new_expense();

-- Fix foreign key constraint issue by allowing cascade deletion
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_expense_id_fkey;
ALTER TABLE purchases ADD CONSTRAINT purchases_expense_id_fkey 
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;

-- Similarly for income number generation
CREATE OR REPLACE FUNCTION public.generate_income_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  max_income_num INTEGER;
  new_income_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the highest income number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(income_number FROM 'INC-' || current_year || '-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_income_num
  FROM public.incomes
  WHERE income_number LIKE 'INC-' || current_year || '-%';
  
  new_income_number := 'INC-' || current_year || '-' || LPAD(max_income_num::TEXT, 4, '0');
  
  RETURN new_income_number;
END;
$function$;

-- Create trigger to auto-generate income numbers
CREATE OR REPLACE FUNCTION public.handle_new_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.income_number IS NULL OR NEW.income_number = '' THEN
    NEW.income_number := public.generate_income_number();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS handle_new_income_trigger ON incomes;
CREATE TRIGGER handle_new_income_trigger
  BEFORE INSERT ON incomes
  FOR EACH ROW EXECUTE FUNCTION handle_new_income();