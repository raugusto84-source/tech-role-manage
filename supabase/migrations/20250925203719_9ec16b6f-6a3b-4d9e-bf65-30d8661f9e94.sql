-- Fix frequency_type constraint and add start_date field
ALTER TABLE public.scheduled_services 
DROP CONSTRAINT IF EXISTS scheduled_services_frequency_type_check;

-- Add check constraint for valid frequency types
ALTER TABLE public.scheduled_services 
ADD CONSTRAINT scheduled_services_frequency_type_check 
CHECK (frequency_type IN ('minutes', 'days', 'weekly_on_day', 'monthly_on_day'));

-- Add start_date field
ALTER TABLE public.scheduled_services 
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- Update existing records to have a start_date
UPDATE public.scheduled_services 
SET start_date = CURRENT_DATE 
WHERE start_date IS NULL;