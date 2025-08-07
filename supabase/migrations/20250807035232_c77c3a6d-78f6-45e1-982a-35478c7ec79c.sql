-- Agregar campos faltantes a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS requested_date date,
ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS average_service_time integer, -- en minutos
ADD COLUMN IF NOT EXISTS evidence_photos text[]; -- array de URLs de fotos

-- Actualizar valores por defecto
UPDATE public.orders 
SET requested_date = delivery_date 
WHERE requested_date IS NULL;

-- Crear tabla para tipos de servicio si no existe
CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  base_price numeric(10,2) DEFAULT 0,
  estimated_hours integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS en service_types
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Políticas para service_types
CREATE POLICY "Only admins can manage service types" ON public.service_types
FOR ALL USING (get_current_user_role() = 'administrador');

CREATE POLICY "Service types are viewable by everyone" ON public.service_types
FOR SELECT USING (is_active = true);

-- Insertar algunos tipos de servicio por defecto
INSERT INTO public.service_types (name, description, base_price, estimated_hours) VALUES
('Formateo de PC', 'Formateo completo del sistema operativo', 150.00, 2),
('Reparación de Hardware', 'Diagnóstico y reparación de componentes', 200.00, 3),
('Instalación de Software', 'Instalación y configuración de programas', 80.00, 1),
('Mantenimiento Preventivo', 'Limpieza y optimización del equipo', 100.00, 1),
('Soporte Técnico', 'Asistencia técnica general', 120.00, 2)
ON CONFLICT DO NOTHING;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_types_updated_at
  BEFORE UPDATE ON public.service_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();