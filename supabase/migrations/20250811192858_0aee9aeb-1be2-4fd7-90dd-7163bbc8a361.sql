-- Add day_of_month column to fixed_expenses table
ALTER TABLE public.fixed_expenses 
ADD COLUMN IF NOT EXISTS day_of_month INTEGER DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 31);

-- Add comment explaining the column
COMMENT ON COLUMN public.fixed_expenses.day_of_month IS 'Day of the month when the recurring expense should be executed (1-31)';

-- Add day_of_month column to recurring_payrolls table
ALTER TABLE public.recurring_payrolls 
ADD COLUMN IF NOT EXISTS day_of_month INTEGER DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 31);

-- Add comment explaining the column
COMMENT ON COLUMN public.recurring_payrolls.day_of_month IS 'Day of the month when the recurring payroll should be executed (1-31)';