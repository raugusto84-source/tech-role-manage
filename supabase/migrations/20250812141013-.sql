-- Add home service fields to orders table
ALTER TABLE public.orders 
ADD COLUMN is_home_service boolean DEFAULT false,
ADD COLUMN service_location jsonb,
ADD COLUMN travel_time_hours numeric DEFAULT 0;