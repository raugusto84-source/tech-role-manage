-- Agregar columnas de período de capacitación JCF en profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS jcf_training_start_date DATE,
ADD COLUMN IF NOT EXISTS jcf_training_end_date DATE;

-- Comentarios para documentación
COMMENT ON COLUMN public.profiles.jcf_training_start_date IS 'Fecha de inicio del período de capacitación JCF';
COMMENT ON COLUMN public.profiles.jcf_training_end_date IS 'Fecha de fin del período de capacitación JCF';