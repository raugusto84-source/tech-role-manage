-- Add special price fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS special_price_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS special_price numeric,
ADD COLUMN IF NOT EXISTS special_price_set_by uuid,
ADD COLUMN IF NOT EXISTS special_price_set_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.special_price_enabled IS 'If true, the client pays the special_price instead of calculated total';
COMMENT ON COLUMN public.orders.special_price IS 'The special/discounted price set by admin';
COMMENT ON COLUMN public.orders.special_price_set_by IS 'User ID of admin who set the special price';
COMMENT ON COLUMN public.orders.special_price_set_at IS 'When the special price was set';