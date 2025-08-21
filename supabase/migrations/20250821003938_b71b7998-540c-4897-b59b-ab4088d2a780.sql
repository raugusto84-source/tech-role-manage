-- Migration: Consolidate categories into a single unified system

-- First, let's ensure main_service_categories has all needed categories
INSERT INTO public.main_service_categories (name, description, icon, is_active)
VALUES 
  ('Alarmas', 'Sistemas de alarmas y seguridad', 'shield-alert', true),
  ('Servicio Técnico', 'Servicios técnicos generales y mantenimiento', 'wrench', true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;

-- Add category_id column to service_types table
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.main_service_categories(id);

-- Create a function to map category names to IDs
CREATE OR REPLACE FUNCTION map_category_name_to_id(category_name TEXT)
RETURNS UUID AS $$
DECLARE
  category_uuid UUID;
BEGIN
  -- Map category names to main_service_categories
  SELECT id INTO category_uuid
  FROM public.main_service_categories
  WHERE LOWER(name) LIKE LOWER('%' || 
    CASE 
      WHEN category_name = 'Computadoras' THEN 'Computadora'
      WHEN category_name = 'Cámaras de Seguridad' THEN 'Cámaras'
      WHEN category_name = 'general' OR category_name = 'mantenimiento' THEN 'Servicio Técnico'
      ELSE category_name
    END || '%')
  AND is_active = true
  LIMIT 1;
  
  RETURN category_uuid;
END;
$$ LANGUAGE plpgsql;

-- Update service_types to use category IDs instead of category names
UPDATE public.service_types 
SET category_id = map_category_name_to_id(category)
WHERE category IS NOT NULL AND category_id IS NULL;

-- Update diagnostic_flow to ensure it references main_service_categories
-- (diagnostic_flow.category_id should already be pointing to main_service_categories)

-- Add foreign key constraint to enforce referential integrity
ALTER TABLE public.service_types 
ADD CONSTRAINT fk_service_types_category 
FOREIGN KEY (category_id) REFERENCES public.main_service_categories(id);

-- Update diagnostic_flow foreign key if it doesn't exist
ALTER TABLE public.diagnostic_flow 
ADD CONSTRAINT fk_diagnostic_flow_category 
FOREIGN KEY (category_id) REFERENCES public.main_service_categories(id);

-- Clean up function
DROP FUNCTION IF EXISTS map_category_name_to_id(TEXT);