-- Remove cashback-related columns from insurance_policies table
ALTER TABLE public.insurance_policies 
DROP COLUMN IF EXISTS products_generate_cashback,
DROP COLUMN IF EXISTS cashback_percentage;