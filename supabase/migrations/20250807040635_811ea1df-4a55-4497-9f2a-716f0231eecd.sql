-- Agregar campos faltantes a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS requested_date date,
ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS average_service_time integer, -- en minutos
ADD COLUMN IF NOT EXISTS evidence_photos text[]; -- array de URLs de fotos

-- Actualizar valores por defecto para requested_date
UPDATE public.orders 
SET requested_date = delivery_date 
WHERE requested_date IS NULL;

-- Insertar algunos tipos de servicio por defecto en service_types si ya existe
INSERT INTO public.service_types (name, description, base_price, estimated_hours) VALUES
('Formateo de PC', 'Formateo completo del sistema operativo', 150.00, 2),
('Reparación de Hardware', 'Diagnóstico y reparación de componentes', 200.00, 3),
('Instalación de Software', 'Instalación y configuración de programas', 80.00, 1),
('Mantenimiento Preventivo', 'Limpieza y optimización del equipo', 100.00, 1),
('Soporte Técnico', 'Asistencia técnica general', 120.00, 2)
ON CONFLICT DO NOTHING;