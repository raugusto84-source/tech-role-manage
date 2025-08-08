-- Update payrolls table to include bonuses and extra payments
ALTER TABLE public.payrolls 
ADD COLUMN IF NOT EXISTS extra_payments numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_description text;

-- Update recurring_payrolls to support default bonuses
ALTER TABLE public.recurring_payrolls
ADD COLUMN IF NOT EXISTS default_bonus numeric DEFAULT 0;

-- Update the run-recurring-payrolls function to handle bonuses
CREATE OR REPLACE FUNCTION public.calculate_weekly_payroll_date(base_date date, cutoff_weekday integer)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_weekday integer;
  days_to_add integer;
BEGIN
  -- Get current day of week (0=Sunday, 1=Monday, etc.)
  current_weekday := EXTRACT(dow FROM base_date);
  
  -- Calculate days to add to reach next cutoff
  IF current_weekday <= cutoff_weekday THEN
    days_to_add := cutoff_weekday - current_weekday;
  ELSE
    days_to_add := 7 - current_weekday + cutoff_weekday;
  END IF;
  
  RETURN base_date + INTERVAL '1 day' * days_to_add;
END;
$$;