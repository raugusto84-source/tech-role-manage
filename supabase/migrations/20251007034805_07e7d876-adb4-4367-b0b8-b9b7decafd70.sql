-- Add week_interval column to scheduled_services table
-- This allows storing intervals like "every 2 weeks", "every 3 weeks", etc.
ALTER TABLE public.scheduled_services 
ADD COLUMN IF NOT EXISTS week_interval INTEGER DEFAULT 1 CHECK (week_interval >= 1 AND week_interval <= 52);

COMMENT ON COLUMN public.scheduled_services.week_interval IS 'Number of weeks between executions when frequency_type is weekly_on_day (1=every week, 2=every 2 weeks, etc.)';

-- Update existing records to have week_interval = 1 (every week)
UPDATE public.scheduled_services 
SET week_interval = 1 
WHERE week_interval IS NULL;