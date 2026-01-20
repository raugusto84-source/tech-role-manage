-- Crear tabla para servicios individuales por equipo
CREATE TABLE public.order_equipment_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_equipment_id UUID NOT NULL REFERENCES public.order_equipment(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_equipment_services ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view equipment services" 
ON public.order_equipment_services 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert equipment services" 
ON public.order_equipment_services 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update equipment services" 
ON public.order_equipment_services 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete equipment services" 
ON public.order_equipment_services 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create index for performance
CREATE INDEX idx_order_equipment_services_equipment_id ON public.order_equipment_services(order_equipment_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_order_equipment_services_updated_at
BEFORE UPDATE ON public.order_equipment_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();