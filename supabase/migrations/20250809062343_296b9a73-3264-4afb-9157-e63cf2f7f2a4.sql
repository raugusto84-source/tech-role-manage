-- Crear tabla para impuestos/retenciones globales
CREATE TABLE public.tax_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_name TEXT NOT NULL,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('iva', 'retencion')),
  tax_rate NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.tax_definitions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage tax definitions"
ON public.tax_definitions
FOR ALL
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view tax definitions"
ON public.tax_definitions
FOR SELECT
USING (is_active = true);

-- Insertar impuestos predeterminados
INSERT INTO public.tax_definitions (tax_name, tax_type, tax_rate) VALUES
-- IVAs
('IVA Exento', 'iva', 0),
('IVA Productos Básicos', 'iva', 5),
('IVA Estándar', 'iva', 16),
('IVA Servicios', 'iva', 19),

-- Retenciones
('Retención Compras Generales', 'retencion', 1),
('Retención Servicios', 'retencion', 2),
('Retención Servicios Profesionales', 'retencion', 3.5),
('Retención Servicios Técnicos', 'retencion', 4),
('Retención Honorarios', 'retencion', 6),
('Retención Pagos al Exterior', 'retencion', 10),
('Retención ICA', 'retencion', 0.414),
('Retención IVA', 'retencion', 15);

-- Trigger para updated_at
CREATE TRIGGER update_tax_definitions_updated_at
BEFORE UPDATE ON public.tax_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();