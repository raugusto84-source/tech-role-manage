-- Create service categories table
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for service categories
CREATE POLICY "Everyone can view active service categories" 
ON public.service_categories 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage service categories" 
ON public.service_categories 
FOR ALL 
USING (get_current_user_role() = 'administrador');

-- Add category_id to service_types
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id);

-- Update technician_skills to use category instead of service_type
ALTER TABLE public.technician_skills 
DROP COLUMN IF EXISTS service_type_id,
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id);

-- Update sales_skills to use category instead of service_type  
ALTER TABLE public.sales_skills 
DROP COLUMN IF EXISTS service_type_id,
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id);

-- Insert some default categories
INSERT INTO public.service_categories (name, description, icon) VALUES
('Reparación de Hardware', 'Servicios de reparación y mantenimiento de componentes físicos', 'wrench'),
('Software y Sistemas', 'Instalación, configuración y soporte de software', 'monitor'),
('Redes y Conectividad', 'Configuración y mantenimiento de redes', 'wifi'),
('Consultoría TI', 'Servicios de consultoría y asesoramiento tecnológico', 'lightbulb'),
('Mantenimiento Preventivo', 'Servicios de mantenimiento preventivo y limpieza', 'shield-check');

-- Create trigger for updated_at
CREATE TRIGGER update_service_categories_updated_at
BEFORE UPDATE ON public.service_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();