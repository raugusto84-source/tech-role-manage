-- Update sales_skills table to match technician skills structure
ALTER TABLE sales_skills 
DROP COLUMN IF EXISTS skill_category,
DROP COLUMN IF EXISTS skill_name,
DROP COLUMN IF EXISTS expertise_level,
DROP COLUMN IF EXISTS years_experience,
DROP COLUMN IF EXISTS certifications;

-- Add new columns to match service-based structure
ALTER TABLE sales_skills 
ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES service_types(id),
ADD COLUMN IF NOT EXISTS skill_level integer NOT NULL DEFAULT 1;

-- Update existing records to use a default service type if any exist
-- (This is safe since we're dropping the old columns anyway)