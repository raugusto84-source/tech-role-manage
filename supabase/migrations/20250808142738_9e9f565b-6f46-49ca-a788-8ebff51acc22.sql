-- Crear tabla de categorías de ventas
CREATE TABLE public.sales_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'package',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de productos/subcategorías de ventas
CREATE TABLE public.sales_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.sales_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear nueva tabla de habilidades de ventas por categorías
CREATE TABLE public.sales_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salesperson_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.sales_categories(id) ON DELETE CASCADE,
  knowledge_level INTEGER NOT NULL DEFAULT 1 CHECK (knowledge_level >= 1 AND knowledge_level <= 5),
  specialization_products UUID[] DEFAULT '{}', -- IDs de productos específicos donde se especializa
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(salesperson_id, category_id)
);

-- Insertar categorías de ejemplo
INSERT INTO public.sales_categories (name, description, icon) VALUES
('Cámaras de Seguridad', 'Sistemas de videovigilancia y monitoreo', 'camera'),
('Control de Acceso', 'Sistemas de control y restricción de acceso', 'key'),
('Alarmas', 'Sistemas de detección y alertas de seguridad', 'shield-alert'),
('Redes y Conectividad', 'Equipos de red y telecomunicaciones', 'wifi'),
('Iluminación LED', 'Sistemas de iluminación LED y smart lighting', 'lightbulb');

-- Insertar productos de ejemplo para Cámaras de Seguridad
INSERT INTO public.sales_products (category_id, name, description, brand, model) 
SELECT id, 'Cámaras Analógicas DAHUA', 'Cámaras de seguridad analógicas de alta definición', 'DAHUA', 'Analógicas'
FROM public.sales_categories WHERE name = 'Cámaras de Seguridad';

INSERT INTO public.sales_products (category_id, name, description, brand, model) 
SELECT id, 'Cámaras IP HIKVISION', 'Cámaras de seguridad IP con tecnología avanzada', 'HIKVISION', 'IP Series'
FROM public.sales_categories WHERE name = 'Cámaras de Seguridad';

INSERT INTO public.sales_products (category_id, name, description, brand) 
SELECT id, 'Fuentes para Cámaras', 'Fuentes de alimentación para sistemas de cámaras', 'Genérico'
FROM public.sales_categories WHERE name = 'Cámaras de Seguridad';

INSERT INTO public.sales_products (category_id, name, description, brand) 
SELECT id, 'DVR/NVR', 'Sistemas de grabación digital y de red', 'HIKVISION/DAHUA'
FROM public.sales_categories WHERE name = 'Cámaras de Seguridad';

-- Insertar productos para Control de Acceso
INSERT INTO public.sales_products (category_id, name, description, brand) 
SELECT id, 'Lectores de Tarjetas', 'Lectores de proximidad y tarjetas RFID', 'HID/Suprema'
FROM public.sales_categories WHERE name = 'Control de Acceso';

INSERT INTO public.sales_products (category_id, name, description, brand) 
SELECT id, 'Cerraduras Electromagnéticas', 'Cerraduras eléctricas de alta seguridad', 'Yale/Securitron'
FROM public.sales_categories WHERE name = 'Control de Acceso';

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.sales_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_knowledge ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sales_categories
CREATE POLICY "Everyone can view active sales categories" 
ON public.sales_categories 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage sales categories" 
ON public.sales_categories 
FOR ALL 
USING (get_current_user_role() = 'administrador');

-- Políticas RLS para sales_products
CREATE POLICY "Everyone can view active sales products" 
ON public.sales_products 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage sales products" 
ON public.sales_products 
FOR ALL 
USING (get_current_user_role() = 'administrador');

-- Políticas RLS para sales_knowledge
CREATE POLICY "Salespeople can view their own knowledge" 
ON public.sales_knowledge 
FOR SELECT 
USING (
  salesperson_id = auth.uid() OR 
  get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text])
);

CREATE POLICY "Admins can manage all sales knowledge" 
ON public.sales_knowledge 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Salespeople can update their own knowledge" 
ON public.sales_knowledge 
FOR UPDATE 
USING (salesperson_id = auth.uid());

-- Crear triggers para updated_at
CREATE TRIGGER update_sales_categories_updated_at
  BEFORE UPDATE ON public.sales_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_products_updated_at
  BEFORE UPDATE ON public.sales_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_knowledge_updated_at
  BEFORE UPDATE ON public.sales_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();