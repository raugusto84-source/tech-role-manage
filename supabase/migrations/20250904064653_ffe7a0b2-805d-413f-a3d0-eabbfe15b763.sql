-- Add cashback tracking fields to quotes table
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS cashback_applied boolean DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS cashback_amount_used numeric DEFAULT 0;

-- Add cashback tracking fields to orders table  
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashback_applied boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashback_amount_used numeric DEFAULT 0;