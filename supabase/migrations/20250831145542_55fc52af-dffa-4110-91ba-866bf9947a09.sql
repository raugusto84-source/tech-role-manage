-- Remove problematic timezone adjustments that caused 6h offset and set proper default for work_date
-- 1) Drop the timezone fix trigger and function if they exist
DROP TRIGGER IF EXISTS fix_employee_date_timezone_trigger ON public.time_records;
DROP FUNCTION IF EXISTS public.fix_employee_date_timezone();

-- 2) Ensure work_date defaults to local (America/Mexico_City) date instead of UTC
ALTER TABLE public.time_records 
  ALTER COLUMN work_date SET DEFAULT ((now() AT TIME ZONE 'America/Mexico_City')::date);

-- Note: check_in_time and check_out_time remain TIMESTAMP WITH TIME ZONE and should not be altered by triggers.
--       They will be stored in UTC and rendered in local time by the client.