-- Add withholdings support to quote_items table
ALTER TABLE public.quote_items ADD COLUMN withholding_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN withholding_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN withholding_type TEXT DEFAULT '';

-- Update default VAT rate from 19% to 16%
ALTER TABLE public.quote_items ALTER COLUMN vat_rate SET DEFAULT 16.00;