-- Crear tabla para categorías de equipos
CREATE TABLE public.equipment_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para marcas de equipos  
CREATE TABLE public.equipment_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para modelos de equipos
CREATE TABLE public.equipment_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.equipment_brands(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para equipos en órdenes
CREATE TABLE public.order_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.equipment_categories(id),
  brand_id UUID REFERENCES public.equipment_brands(id),
  model_id UUID REFERENCES public.equipment_models(id),
  equipment_name TEXT NOT NULL,
  brand_name TEXT,
  model_name TEXT,
  serial_number TEXT,
  physical_condition TEXT,
  problem_description TEXT,
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_equipment ENABLE ROW LEVEL SECURITY;

-- Políticas para equipment_categories
CREATE POLICY "Everyone can view active equipment categories" 
ON public.equipment_categories FOR SELECT 
USING (is_active = true);

CREATE POLICY "Staff can manage equipment categories" 
ON public.equipment_categories FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

-- Políticas para equipment_brands
CREATE POLICY "Everyone can view active equipment brands" 
ON public.equipment_brands FOR SELECT 
USING (is_active = true);

CREATE POLICY "Staff can manage equipment brands" 
ON public.equipment_brands FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

-- Políticas para equipment_models
CREATE POLICY "Everyone can view active equipment models" 
ON public.equipment_models FOR SELECT 
USING (is_active = true);

CREATE POLICY "Staff can manage equipment models" 
ON public.equipment_models FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

-- Políticas para order_equipment
CREATE POLICY "Staff can manage order equipment" 
ON public.order_equipment FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]));

CREATE POLICY "Users can view equipment for their orders" 
ON public.order_equipment FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM orders o
  LEFT JOIN clients c ON c.id = o.client_id
  LEFT JOIN profiles p ON p.user_id = auth.uid()
  WHERE o.id = order_equipment.order_id 
  AND (
    o.assigned_technician = auth.uid() OR
    p.role = 'administrador'::user_role OR
    (p.role = 'cliente'::user_role AND c.email = p.email) OR
    p.role = 'vendedor'::user_role OR
    p.role = 'supervisor'::user_role
  )
));

CREATE POLICY "Clients can create equipment for their orders" 
ON public.order_equipment FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM orders o
  JOIN clients c ON c.id = o.client_id
  JOIN profiles p ON p.email = c.email
  WHERE o.id = order_equipment.order_id 
  AND p.user_id = auth.uid() 
  AND p.role = 'cliente'::user_role
));

-- Insertar algunas categorías por defecto
INSERT INTO public.equipment_categories (name, description, icon) VALUES
('Computadoras', 'Equipos de cómputo y laptops', '💻'),
('Impresoras', 'Impresoras y multifuncionales', '🖨️'),
('Cámaras', 'Cámaras de seguridad y videovigilancia', '📹'),
('Servidores', 'Servidores y equipos de red', '🖥️'),
('UPS', 'Sistemas de alimentación ininterrumpida', '⚡'),
('Telefonía', 'Equipos de telecomunicaciones', '📞'),
('Audio/Video', 'Equipos de audio y video', '🔊'),
('Otros', 'Otros equipos electrónicos', '⚙️');

-- Insertar algunas marcas por defecto
INSERT INTO public.equipment_brands (name) VALUES
('Dell'), ('HP'), ('Lenovo'), ('Acer'), ('ASUS'), 
('Canon'), ('Epson'), ('Samsung'), ('LG'), ('Sony'),
('Cisco'), ('D-Link'), ('TP-Link'), ('Ubiquiti'),
('APC'), ('Tripp Lite'), ('Forza'), 
('Dahua'), ('Hikvision'), ('Axis');

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_equipment_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_equipment_categories_updated_at
    BEFORE UPDATE ON public.equipment_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_updated_at_column();

CREATE TRIGGER update_equipment_brands_updated_at
    BEFORE UPDATE ON public.equipment_brands
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_updated_at_column();

CREATE TRIGGER update_equipment_models_updated_at
    BEFORE UPDATE ON public.equipment_models
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_updated_at_column();

CREATE TRIGGER update_order_equipment_updated_at
    BEFORE UPDATE ON public.order_equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_updated_at_column();