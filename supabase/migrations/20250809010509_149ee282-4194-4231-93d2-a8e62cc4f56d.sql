-- Add months_experience column to technical_knowledge table
ALTER TABLE public.technical_knowledge 
ADD COLUMN IF NOT EXISTS months_experience INTEGER DEFAULT 0;