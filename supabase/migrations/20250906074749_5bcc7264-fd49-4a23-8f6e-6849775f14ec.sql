-- Add category column to fleet_groups table
ALTER TABLE public.fleet_groups 
ADD COLUMN category TEXT NOT NULL DEFAULT 'sistemas'
CHECK (category IN ('sistemas', 'seguridad'));

-- Add comment to explain the category column
COMMENT ON COLUMN public.fleet_groups.category IS 'Fleet category: sistemas or seguridad';