-- Add cashback fields to quotes table if they don't exist
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS apply_cashback BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cashback_amount NUMERIC(10,2) DEFAULT 0;