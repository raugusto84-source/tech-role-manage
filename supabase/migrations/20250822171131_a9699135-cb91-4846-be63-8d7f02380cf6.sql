-- Add quantity column to scheduled_services table
ALTER TABLE public.scheduled_services 
ADD COLUMN quantity integer NOT NULL DEFAULT 1;