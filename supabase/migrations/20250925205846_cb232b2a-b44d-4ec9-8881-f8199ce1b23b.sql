-- Remove the foreign key constraint on service_type_id since we now use services array
ALTER TABLE public.scheduled_services 
DROP CONSTRAINT IF EXISTS scheduled_services_service_type_id_fkey;

-- Update the insertion logic to handle the new structure properly
-- The services array now contains the service type information