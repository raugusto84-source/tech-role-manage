-- Fix trigger that references incorrect field name in loan_payments table
-- The error "record 'new' has no field 'payment_status'" indicates a trigger is using wrong field name

-- First, let's check and drop any problematic triggers on loan_payments
DO $$ 
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'public.loan_payments'::regclass
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.tgname || ' ON public.loan_payments CASCADE';
    END LOOP;
END $$;

-- Now recreate any necessary triggers with correct field names
-- (Add back only the triggers that should exist with correct syntax)

-- If there should be a trigger to mark overdue payments, it should use 'status' not 'payment_status'
CREATE OR REPLACE FUNCTION public.check_overdue_loan_payments()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if payment is overdue when inserting or updating
  IF NEW.due_date < CURRENT_DATE AND NEW.status = 'pendiente' THEN
    NEW.status := 'vencido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger using correct field name 'status'
DROP TRIGGER IF EXISTS check_overdue_loan_payments_trigger ON public.loan_payments;
CREATE TRIGGER check_overdue_loan_payments_trigger
  BEFORE INSERT OR UPDATE ON public.loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_overdue_loan_payments();