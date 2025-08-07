-- Now we can safely remove the old client columns
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_name CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_email CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_phone CASCADE;