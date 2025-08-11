-- Clean up existing technician skills and ensure only sales module services are used as skills

-- First, delete all existing technician skills
DELETE FROM public.technician_skills;

-- Create an index for better performance on the service_type_id lookup
CREATE INDEX IF NOT EXISTS idx_technician_skills_service_type 
ON public.technician_skills(service_type_id);

-- Add a proper foreign key constraint to ensure service_type_id exists in service_types
ALTER TABLE public.technician_skills 
DROP CONSTRAINT IF EXISTS fk_technician_skills_service_type;

ALTER TABLE public.technician_skills 
ADD CONSTRAINT fk_technician_skills_service_type 
FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) ON DELETE CASCADE;

-- Add a comment to document that skills are now based on sales module services
COMMENT ON TABLE public.technician_skills IS 'Technical skills for technicians based on active services from the sales module. Each skill represents proficiency in a specific service type.';

COMMENT ON COLUMN public.technician_skills.service_type_id IS 'References service_types table - represents a specific service that the technician can perform';

-- Create a view that shows only service-based skills (excluding articles)
CREATE OR REPLACE VIEW public.technician_service_skills AS
SELECT 
  ts.*,
  st.name as service_name,
  st.description as service_description,
  st.category as service_category,
  st.estimated_hours as service_estimated_hours
FROM public.technician_skills ts
INNER JOIN public.service_types st ON ts.service_type_id = st.id
WHERE st.is_active = true AND st.item_type = 'servicio';