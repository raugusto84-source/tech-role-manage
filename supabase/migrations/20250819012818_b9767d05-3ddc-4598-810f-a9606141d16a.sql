-- Check what's wrong with diagnostic_questions table
-- First, let's see what columns exist
SELECT column_name, is_nullable, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'diagnostic_questions' 
AND table_schema = 'public';

-- Let's check if there's an old service_type column that needs to be dropped
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnostic_questions' AND column_name = 'service_type') THEN
    -- Drop the old service_type column that we don't need
    ALTER TABLE public.diagnostic_questions DROP COLUMN service_type;
  END IF;
END $$;