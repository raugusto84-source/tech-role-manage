-- Add columns to track who completed the order
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS completed_by_name text;

COMMENT ON COLUMN public.orders.completed_by IS 'ID del técnico que completó la orden';
COMMENT ON COLUMN public.orders.completed_by_name IS 'Nombre del técnico que completó la orden';