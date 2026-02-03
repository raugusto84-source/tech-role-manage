-- Add quote_id column to orders table to track which quote generated the order
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON public.orders(quote_id);