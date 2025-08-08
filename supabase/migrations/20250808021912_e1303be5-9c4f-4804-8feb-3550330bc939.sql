-- Add withdrawal tracking and VAT management to expenses and incomes

-- Add withdrawal tracking columns to expenses
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS withdrawal_status text NOT NULL DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS withdrawn_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS withdrawn_by uuid,
ADD COLUMN IF NOT EXISTS vat_rate numeric,
ADD COLUMN IF NOT EXISTS vat_amount numeric,
ADD COLUMN IF NOT EXISTS taxable_amount numeric;

-- Add VAT columns to incomes  
ALTER TABLE public.incomes
ADD COLUMN IF NOT EXISTS vat_rate numeric,
ADD COLUMN IF NOT EXISTS vat_amount numeric,
ADD COLUMN IF NOT EXISTS taxable_amount numeric;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_account_type ON public.expenses(account_type);
CREATE INDEX IF NOT EXISTS idx_expenses_withdrawal_status ON public.expenses(withdrawal_status);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_incomes_income_date ON public.incomes(income_date);

-- Add constraint for withdrawal status
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS check_withdrawal_status;
ALTER TABLE public.expenses ADD CONSTRAINT check_withdrawal_status 
CHECK (withdrawal_status IN ('pendiente', 'retirado'));

-- Update function to create expense for employee payments
CREATE OR REPLACE FUNCTION public.create_expense_for_employee_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.expenses (
    amount, description, category, account_type, payment_method, expense_date, status
  ) VALUES (
    NEW.amount,
    (CASE WHEN NEW.payment_type = 'comision'
      THEN '[Comisión] ' || NEW.employee_name
      ELSE '[Bono] ' || NEW.employee_name
    END) || (CASE WHEN NEW.description IS NOT NULL THEN ' - ' || NEW.description ELSE '' END),
    CASE WHEN NEW.payment_type = 'comision' THEN 'comision' ELSE 'bono' END,
    NEW.account_type,
    NEW.payment_method,
    NEW.payment_date,
    'pagado'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for employee payments
DROP TRIGGER IF EXISTS create_expense_for_employee_payment_trigger ON public.employee_payments;
CREATE TRIGGER create_expense_for_employee_payment_trigger
  AFTER INSERT ON public.employee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_expense_for_employee_payment();