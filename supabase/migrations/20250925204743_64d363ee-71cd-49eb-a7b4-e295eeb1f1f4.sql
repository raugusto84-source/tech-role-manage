-- Modify scheduled_services table to support multiple services in one record
-- Add services column to store array of services with quantities
ALTER TABLE public.scheduled_services 
ADD COLUMN services JSONB DEFAULT NULL;

-- Add index for better performance on services column  
CREATE INDEX idx_scheduled_services_services ON public.scheduled_services USING GIN (services);

-- Update existing records to migrate to new format
UPDATE public.scheduled_services 
SET services = jsonb_build_array(
  jsonb_build_object(
    'service_type_id', service_type_id,
    'quantity', quantity
  )
)
WHERE services IS NULL;

-- Make service_type_id nullable since now we use services array
ALTER TABLE public.scheduled_services 
ALTER COLUMN service_type_id DROP NOT NULL;