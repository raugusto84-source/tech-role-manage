-- Crear tabla para registros de asistencia de órdenes
CREATE TABLE public.order_assistance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('arrival', 'departure')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  location_latitude NUMERIC NOT NULL,
  location_longitude NUMERIC NOT NULL,
  location_address TEXT,
  evidence_photos JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.order_assistance_records ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Technicians can manage their own assistance records" 
ON public.order_assistance_records 
FOR ALL 
USING (technician_id = auth.uid());

CREATE POLICY "Staff can view all assistance records" 
ON public.order_assistance_records 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

CREATE POLICY "Clients can view assistance records for their orders" 
ON public.order_assistance_records 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM orders o 
  JOIN clients c ON c.id = o.client_id
  JOIN profiles p ON p.email = c.email
  WHERE o.id = order_assistance_records.order_id 
  AND p.user_id = auth.uid()
));

-- Función para actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para timestamp automático
CREATE TRIGGER update_order_assistance_records_updated_at
  BEFORE UPDATE ON public.order_assistance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejorar rendimiento
CREATE INDEX idx_order_assistance_records_order_id ON public.order_assistance_records(order_id);
CREATE INDEX idx_order_assistance_records_technician_id ON public.order_assistance_records(technician_id);
CREATE INDEX idx_order_assistance_records_timestamp ON public.order_assistance_records(timestamp);