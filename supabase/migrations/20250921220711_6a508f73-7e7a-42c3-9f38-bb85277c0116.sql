-- Add ISR withholding columns to incomes table
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS isr_withholding_rate numeric DEFAULT 0;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS isr_withholding_amount numeric DEFAULT 0;

-- Add ISR withholding columns to order_payments table  
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS isr_withholding_applied boolean DEFAULT false;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS isr_withholding_amount numeric DEFAULT 0;