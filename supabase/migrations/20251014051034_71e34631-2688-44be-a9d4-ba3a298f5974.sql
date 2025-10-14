-- Add day_of_week column for weekly recurring payrolls
ALTER TABLE public.recurring_payrolls 
ADD COLUMN IF NOT EXISTS day_of_week INTEGER;

COMMENT ON COLUMN public.recurring_payrolls.day_of_week IS 'Day of week for weekly payrolls: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';

-- Add check constraint to ensure day_of_week is valid when frequency is weekly
ALTER TABLE public.recurring_payrolls 
ADD CONSTRAINT check_day_of_week_range 
CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6));