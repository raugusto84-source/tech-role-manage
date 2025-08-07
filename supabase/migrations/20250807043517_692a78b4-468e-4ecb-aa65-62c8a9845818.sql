-- Add client_id to orders table
ALTER TABLE public.orders ADD COLUMN client_id UUID REFERENCES public.clients(id);

-- Update requested_date default to now() - changing from date field to timestamp
ALTER TABLE public.orders ALTER COLUMN requested_date TYPE TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ALTER COLUMN requested_date SET DEFAULT now();

-- Change average_service_time to hours (numeric)
ALTER TABLE public.orders ALTER COLUMN average_service_time TYPE NUMERIC(10,2);