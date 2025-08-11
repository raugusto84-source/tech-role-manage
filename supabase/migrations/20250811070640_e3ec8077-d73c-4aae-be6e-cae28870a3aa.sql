-- Agregar nuevo estado "pendiente_entrega" al enum order_status
ALTER TYPE order_status ADD VALUE 'pendiente_entrega';

-- Crear tabla para firmas de conformidad de entrega
CREATE TABLE public.delivery_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  client_signature_data TEXT NOT NULL,
  client_name TEXT NOT NULL,
  delivery_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en la tabla de firmas de entrega
ALTER TABLE public.delivery_signatures ENABLE ROW LEVEL SECURITY;

-- Política para que los clientes puedan crear firmas de entrega para sus órdenes
CREATE POLICY "Clients can create delivery signatures for their orders" 
ON public.delivery_signatures 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN profiles p ON p.email = c.email
    WHERE o.id = delivery_signatures.order_id 
    AND p.user_id = auth.uid()
    AND o.status = 'pendiente_entrega'::order_status
  )
);

-- Política para que los usuarios puedan ver las firmas de entrega de órdenes a las que tienen acceso
CREATE POLICY "Users can view delivery signatures for accessible orders" 
ON public.delivery_signatures 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = delivery_signatures.order_id 
    AND (
      o.assigned_technician = auth.uid() OR 
      p.role = 'administrador'::user_role OR 
      (p.role = 'cliente'::user_role AND c.email = p.email)
    )
  )
);

-- Staff puede ver todas las firmas de entrega
CREATE POLICY "Staff can view all delivery signatures" 
ON public.delivery_signatures 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'tecnico'::user_role, 'vendedor'::user_role])
  )
);

-- Modificar la tabla order_satisfaction_surveys para simplificar a 3 preguntas básicas
ALTER TABLE public.order_satisfaction_surveys 
DROP COLUMN IF EXISTS technician_knowledge,
DROP COLUMN IF EXISTS technician_customer_service,
DROP COLUMN IF EXISTS technician_attitude,
DROP COLUMN IF EXISTS sales_knowledge,
DROP COLUMN IF EXISTS sales_customer_service,
DROP COLUMN IF EXISTS sales_attitude,
DROP COLUMN IF EXISTS sales_comments,
DROP COLUMN IF EXISTS technician_comments;

-- Agregar las 3 preguntas básicas
ALTER TABLE public.order_satisfaction_surveys 
ADD COLUMN service_quality INTEGER CHECK (service_quality BETWEEN 1 AND 5),
ADD COLUMN service_time INTEGER CHECK (service_time BETWEEN 1 AND 5),
ADD COLUMN would_recommend INTEGER CHECK (would_recommend BETWEEN 1 AND 5);

-- Función para cambiar estado a pendiente_entrega cuando se finaliza una orden
CREATE OR REPLACE FUNCTION public.set_pending_delivery_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Solo cambiar a pendiente_entrega cuando se finaliza la orden
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    NEW.status := 'pendiente_entrega'::order_status;
    
    -- Log del cambio de estado
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      'pendiente_entrega'::order_status,
      auth.uid(),
      'Orden lista para entrega al cliente'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para cambiar automáticamente a pendiente_entrega
DROP TRIGGER IF EXISTS trigger_set_pending_delivery ON public.orders;
CREATE TRIGGER trigger_set_pending_delivery
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pending_delivery_on_complete();

-- Función para cerrar definitivamente la orden después de firma y encuesta
CREATE OR REPLACE FUNCTION public.close_order_after_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar si ya existe firma de entrega y encuesta para esta orden
  IF EXISTS (
    SELECT 1 FROM public.delivery_signatures ds
    WHERE ds.order_id = NEW.order_id
  ) AND EXISTS (
    SELECT 1 FROM public.order_satisfaction_surveys oss
    WHERE oss.order_id = NEW.order_id
  ) THEN
    -- Cerrar definitivamente la orden
    UPDATE public.orders 
    SET status = 'finalizada'::order_status,
        updated_at = now()
    WHERE id = NEW.order_id 
    AND status = 'pendiente_entrega'::order_status;
    
    -- Log del cierre definitivo
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.order_id,
      'pendiente_entrega'::order_status,
      'finalizada'::order_status,
      NEW.client_id,
      'Orden cerrada después de entrega y encuesta completada'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para cerrar orden cuando se completa encuesta (después de firma)
DROP TRIGGER IF EXISTS trigger_close_order_after_survey ON public.order_satisfaction_surveys;
CREATE TRIGGER trigger_close_order_after_survey
  AFTER INSERT ON public.order_satisfaction_surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.close_order_after_delivery();