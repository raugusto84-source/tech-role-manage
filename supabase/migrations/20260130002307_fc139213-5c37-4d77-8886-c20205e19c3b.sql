-- Add response_token column to quotes table for email response verification
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS response_token TEXT;