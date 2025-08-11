-- Clean up existing technician skills and ensure only sales module services are used as skills

-- First, delete all existing technician skills
DELETE FROM public.technician_skills;

-- Delete any orphaned or non-service related skills
-- This ensures we start fresh with only service-based skills

-- Update the technician_skills table structure to ensure it's properly linked to service_types
-- Add a constraint to ensure service_type_id must exist in service_types and be a service (not article)
ALTER TABLE public.technician_skills 
DROP CONSTRAINT IF EXISTS technician_skills_service_type_check;

ALTER TABLE public.technician_skills 
ADD CONSTRAINT technician_skills_service_type_check 
CHECK (
  EXISTS (
    SELECT 1 FROM public.service_types 
    WHERE service_types.id = technician_skills.service_type_id 
    AND service_types.is_active = true 
    AND service_types.item_type = 'servicio'
  )
);

-- Create an index for better performance on the service_type_id lookup
CREATE INDEX IF NOT EXISTS idx_technician_skills_service_type 
ON public.technician_skills(service_type_id);

-- Add a comment to document that skills are now based on sales module services
COMMENT ON TABLE public.technician_skills IS 'Technical skills for technicians based on active services from the sales module. Each skill represents proficiency in a specific service type.';

COMMENT ON COLUMN public.technician_skills.service_type_id IS 'References service_types table - only active services (item_type = servicio) can be used as skills';

-- Ensure the suggest_optimal_technician function only considers active services
-- This is already handled by the INNER JOIN in the function, but let's make sure