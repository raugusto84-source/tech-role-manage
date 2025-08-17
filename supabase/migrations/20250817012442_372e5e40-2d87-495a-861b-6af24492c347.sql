-- Create main service categories table first
CREATE TABLE IF NOT EXISTS public.main_service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for main categories
ALTER TABLE public.main_service_categories ENABLE ROW LEVEL SECURITY;

-- Insert default main categories
INSERT INTO public.main_service_categories (name, description, icon) VALUES
('Computadora', 'Servicios y productos para computadoras', 'computer'),
('Cámaras', 'Sistemas de videovigilancia y seguridad', 'camera'),
('Control de Acceso', 'Sistemas de control de acceso y biometría', 'key'),
('Fraccionamientos', 'Servicios para desarrollos habitacionales', 'home'),
('Cercas Eléctricas', 'Sistemas de cercado eléctrico y seguridad perimetral', 'zap')
ON CONFLICT DO NOTHING;

-- RLS Policies for main_service_categories
CREATE POLICY "Everyone can view active main categories"
ON public.main_service_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage main categories"
ON public.main_service_categories FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));