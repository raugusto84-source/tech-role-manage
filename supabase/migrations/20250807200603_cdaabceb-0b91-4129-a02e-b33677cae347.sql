-- Actualizar el enum de estados para incluir "en_camino"
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'en_camino';

-- Agregar tabla para comentarios/notas de órdenes con timestamps
CREATE TABLE IF NOT EXISTS public.order_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en order_notes
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

-- Políticas para order_notes
CREATE POLICY "Staff can manage order notes" 
ON public.order_notes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'tecnico'::user_role])
  )
);

-- Agregar tabla para logs de cambios de estado con timestamps
CREATE TABLE IF NOT EXISTS public.order_status_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status order_status,
  new_status order_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Habilitar RLS en order_status_logs
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para order_status_logs
CREATE POLICY "Staff can view order status logs" 
ON public.order_status_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'tecnico'::user_role])
  )
);

CREATE POLICY "Staff can insert order status logs" 
ON public.order_status_logs 
FOR INSERT 
WITH CHECK (
  changed_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'tecnico'::user_role])
  )
);

-- Función para registrar cambios de estado automáticamente
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si el estado cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE 
        WHEN NEW.status = 'en_camino' THEN 'Técnico en camino al sitio'
        WHEN NEW.status = 'en_proceso' THEN 'Técnico iniciando trabajo'
        WHEN NEW.status = 'finalizada' THEN 'Trabajo completado'
        ELSE NULL
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para registrar cambios de estado
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON public.orders;
CREATE TRIGGER trigger_log_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();