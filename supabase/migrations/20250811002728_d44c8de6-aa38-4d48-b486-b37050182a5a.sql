-- Crear tabla para trackear la carga de trabajo de los técnicos
CREATE TABLE public.technician_workload (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID NOT NULL,
  order_id UUID NOT NULL,
  service_type_id UUID NOT NULL,
  is_shared_service BOOLEAN NOT NULL DEFAULT false,
  estimated_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_technician_workload_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.technician_workload ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage technician workload" 
ON public.technician_workload 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Technicians can view their own workload" 
ON public.technician_workload 
FOR SELECT 
USING (technician_id = auth.uid() OR get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor']));

-- Función para actualizar workload cuando cambia el estado de una orden
CREATE OR REPLACE FUNCTION public.update_technician_workload()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando una orden se finaliza, marcar workload como completado
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    UPDATE public.technician_workload 
    SET status = 'completed', updated_at = now()
    WHERE order_id = NEW.id;
  END IF;
  
  -- Cuando una orden se cancela, marcar workload como cancelado
  IF NEW.status = 'cancelada' AND OLD.status != 'cancelada' THEN
    UPDATE public.technician_workload 
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar workload automáticamente
CREATE TRIGGER update_workload_on_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_technician_workload();

-- Índices para mejorar performance
CREATE INDEX idx_technician_workload_technician_id ON public.technician_workload(technician_id);
CREATE INDEX idx_technician_workload_status ON public.technician_workload(status);
CREATE INDEX idx_technician_workload_shared ON public.technician_workload(is_shared_service);