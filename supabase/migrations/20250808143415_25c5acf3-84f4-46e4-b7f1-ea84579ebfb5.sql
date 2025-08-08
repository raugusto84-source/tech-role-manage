-- Crear tabla de categorías técnicas
CREATE TABLE public.technical_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'wrench',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de productos/subcategorías técnicas
CREATE TABLE public.technical_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.technical_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear nueva tabla de habilidades técnicas por categorías
CREATE TABLE public.technical_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.technical_categories(id) ON DELETE CASCADE,
  skill_level INTEGER NOT NULL DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 5),
  years_experience INTEGER NOT NULL DEFAULT 0,
  specialization_products UUID[] DEFAULT '{}', -- IDs de productos específicos donde se especializa
  certifications TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(technician_id, category_id)
);

-- Insertar categorías técnicas de ejemplo
INSERT INTO public.technical_categories (name, description, icon) VALUES
('Sistemas de Videovigilancia', 'Instalación y mantenimiento de cámaras de seguridad', 'camera'),
('Control de Acceso', 'Sistemas de control y restricción de acceso', 'key'),
('Redes y Conectividad', 'Configuración de redes y sistemas de comunicación', 'wifi'),
('Sistemas de Alarmas', 'Instalación de sistemas de detección y alertas', 'shield-alert'),
('Iluminación Inteligente', 'Sistemas de iluminación LED y automatización', 'lightbulb'),
('Formateo y Reparación PC', 'Mantenimiento y reparación de equipos informáticos', 'cpu'),
('Instalaciones Eléctricas', 'Trabajos eléctricos y cableado', 'wrench');

-- Insertar productos técnicos de ejemplo para Sistemas de Videovigilancia
INSERT INTO public.technical_products (category_id, name, description, brand, model) 
SELECT id, 'Cámaras Analógicas', 'Instalación y configuración de cámaras analógicas', 'DAHUA', 'HAC Series'
FROM public.technical_categories WHERE name = 'Sistemas de Videovigilancia';

INSERT INTO public.technical_products (category_id, name, description, brand, model) 
SELECT id, 'Cámaras IP', 'Instalación y configuración de cámaras IP', 'HIKVISION', 'DS Series'
FROM public.technical_categories WHERE name = 'Sistemas de Videovigilancia';

INSERT INTO public.technical_products (category_id, name, description, brand) 
SELECT id, 'Sistemas DVR/NVR', 'Configuración de sistemas de grabación', 'HIKVISION/DAHUA'
FROM public.technical_categories WHERE name = 'Sistemas de Videovigilancia';

INSERT INTO public.technical_products (category_id, name, description, brand) 
SELECT id, 'Cableado Estructurado', 'Instalación de cableado para cámaras', 'Genérico'
FROM public.technical_categories WHERE name = 'Sistemas de Videovigilancia';

-- Insertar productos para Control de Acceso
INSERT INTO public.technical_products (category_id, name, description, brand) 
SELECT id, 'Lectores Biométricos', 'Instalación de lectores de huella dactilar', 'Suprema/ZK'
FROM public.technical_categories WHERE name = 'Control de Acceso';

INSERT INTO public.technical_products (category_id, name, description, brand) 
SELECT id, 'Cerraduras Electromagnéticas', 'Instalación de cerraduras eléctricas', 'Yale/Securitron'
FROM public.technical_categories WHERE name = 'Control de Acceso';

-- Insertar productos para Formateo y Reparación PC
INSERT INTO public.technical_products (category_id, name, description) 
SELECT id, 'Formateo de Sistemas Windows', 'Instalación y configuración de Windows'
FROM public.technical_categories WHERE name = 'Formateo y Reparación PC';

INSERT INTO public.technical_products (category_id, name, description) 
SELECT id, 'Reparación de Hardware', 'Diagnóstico y reparación de componentes'
FROM public.technical_categories WHERE name = 'Formateo y Reparación PC';

INSERT INTO public.technical_products (category_id, name, description) 
SELECT id, 'Instalación de Software', 'Instalación y configuración de aplicaciones'
FROM public.technical_categories WHERE name = 'Formateo y Reparación PC';

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.technical_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_knowledge ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para technical_categories
CREATE POLICY "Everyone can view active technical categories" 
ON public.technical_categories 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage technical categories" 
ON public.technical_categories 
FOR ALL 
USING (get_current_user_role() = 'administrador');

-- Políticas RLS para technical_products
CREATE POLICY "Everyone can view active technical products" 
ON public.technical_products 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage technical products" 
ON public.technical_products 
FOR ALL 
USING (get_current_user_role() = 'administrador');

-- Políticas RLS para technical_knowledge
CREATE POLICY "Technicians can view their own knowledge" 
ON public.technical_knowledge 
FOR SELECT 
USING (
  technician_id = auth.uid() OR 
  get_current_user_role() = ANY(ARRAY['administrador'::text, 'tecnico'::text])
);

CREATE POLICY "Admins can manage all technical knowledge" 
ON public.technical_knowledge 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Technicians can update their own knowledge" 
ON public.technical_knowledge 
FOR UPDATE 
USING (technician_id = auth.uid());

-- Crear triggers para updated_at
CREATE TRIGGER update_technical_categories_updated_at
  BEFORE UPDATE ON public.technical_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_technical_products_updated_at
  BEFORE UPDATE ON public.technical_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_technical_knowledge_updated_at
  BEFORE UPDATE ON public.technical_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();