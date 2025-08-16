-- Agregar campos de garantía a service_types
ALTER TABLE public.service_types 
ADD COLUMN warranty_duration_days INTEGER DEFAULT 0,
ADD COLUMN warranty_conditions TEXT DEFAULT 'Sin garantía específica';

-- Agregar campos de garantía a order_items
ALTER TABLE public.order_items 
ADD COLUMN warranty_start_date DATE,
ADD COLUMN warranty_end_date DATE,
ADD COLUMN warranty_conditions TEXT;

-- Crear función para calcular fechas de garantía
CREATE OR REPLACE FUNCTION public.calculate_warranty_dates()
RETURNS TRIGGER AS $$
DECLARE
  service_warranty_days INTEGER;
  service_warranty_conditions TEXT;
BEGIN
  -- Solo procesar cuando una orden se finaliza
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Actualizar todos los items de la orden con fechas de garantía
    UPDATE public.order_items 
    SET 
      warranty_start_date = CURRENT_DATE,
      warranty_end_date = CURRENT_DATE + INTERVAL '1 day' * COALESCE(
        (SELECT st.warranty_duration_days 
         FROM public.service_types st 
         WHERE st.id = order_items.service_type_id), 
        0
      ),
      warranty_conditions = COALESCE(
        (SELECT st.warranty_conditions 
         FROM public.service_types st 
         WHERE st.id = order_items.service_type_id),
        'Sin garantía específica'
      )
    WHERE order_id = NEW.id
    AND warranty_start_date IS NULL; -- Solo actualizar si no tiene garantía ya
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para calcular garantías automáticamente
CREATE TRIGGER trigger_calculate_warranty_dates
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_warranty_dates();

-- Crear tabla para reclamos de garantía
CREATE TABLE public.warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  claim_description TEXT NOT NULL,
  claim_type TEXT NOT NULL DEFAULT 'defecto', -- defecto, mal_funcionamiento, incumplimiento
  status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, en_revision, aprobado, rechazado, resuelto
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  resolution_notes TEXT,
  replacement_order_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS en warranty_claims
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para warranty_claims
CREATE POLICY "Clients can create warranty claims for their orders"
ON public.warranty_claims 
FOR INSERT 
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their warranty claims"
ON public.warranty_claims 
FOR SELECT 
USING (
  client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  ) OR 
  get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text, 'vendedor'::text])
);

CREATE POLICY "Staff can manage warranty claims"
ON public.warranty_claims 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text]));