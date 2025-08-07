-- Remove old client columns from orders table since we now use client_id
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_name;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_email;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_phone;