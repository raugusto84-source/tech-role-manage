-- Add priority field to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media';

-- Add a check constraint to ensure valid priority values
ALTER TABLE public.orders 
ADD CONSTRAINT orders_priority_check 
CHECK (priority IN ('baja', 'media', 'alta', 'critica'));

-- Add index for better query performance when filtering by priority
CREATE INDEX IF NOT EXISTS idx_orders_priority ON public.orders(priority);