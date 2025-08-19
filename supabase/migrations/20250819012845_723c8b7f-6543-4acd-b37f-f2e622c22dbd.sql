-- Drop the old service_type column from diagnostic_questions
ALTER TABLE public.diagnostic_questions DROP COLUMN IF EXISTS service_type;