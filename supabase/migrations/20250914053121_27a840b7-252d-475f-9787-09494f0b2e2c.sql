-- Crear tabla para el historial de eventos de órdenes
CREATE TABLE public.order_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  order_number TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'authorized', 'completed', 'signed', 'deleted', 'restored')),
  event_description TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  performed_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Agregar campo para soft delete en orders
ALTER TABLE public.orders 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Habilitar RLS en order_history
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Políticas para order_history
CREATE POLICY "Staff can view order history" 
ON public.order_history 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]));

CREATE POLICY "System can insert order history" 
ON public.order_history 
FOR INSERT 
WITH CHECK (true);

-- Función para registrar eventos en el historial
CREATE OR REPLACE FUNCTION public.log_order_event(
  p_order_id UUID,
  p_order_number TEXT,
  p_event_type TEXT,
  p_event_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  performer_name TEXT;
BEGIN
  -- Obtener el nombre del usuario actual
  SELECT full_name INTO performer_name
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Insertar el evento
  INSERT INTO public.order_history (
    order_id,
    order_number,
    event_type,
    event_description,
    performed_by,
    performed_by_name,
    metadata
  ) VALUES (
    p_order_id,
    p_order_number,
    p_event_type,
    p_event_description,
    auth.uid(),
    COALESCE(performer_name, 'Sistema'),
    p_metadata
  );
END;
$$;

-- Trigger para registrar cuando se crea una orden
CREATE OR REPLACE FUNCTION public.log_order_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.log_order_event(
    NEW.id,
    NEW.order_number,
    'created',
    'Orden creada con estado: ' || NEW.status,
    jsonb_build_object(
      'status', NEW.status,
      'client_id', NEW.client_id,
      'estimated_cost', NEW.estimated_cost
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger para registrar cambios de estado
CREATE OR REPLACE FUNCTION public.log_order_status_change_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Solo registrar si el estado cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'finalizada' THEN
        PERFORM public.log_order_event(
          NEW.id,
          NEW.order_number,
          'completed',
          'Orden completada exitosamente',
          jsonb_build_object(
            'previous_status', OLD.status,
            'new_status', NEW.status,
            'technician', NEW.assigned_technician
          )
        );
      WHEN 'pendiente_aprobacion' THEN
        PERFORM public.log_order_event(
          NEW.id,
          NEW.order_number,
          'authorized',
          'Orden pendiente de autorización del cliente',
          jsonb_build_object(
            'previous_status', OLD.status,
            'new_status', NEW.status
          )
        );
      ELSE
        -- Para otros cambios de estado, registrar el cambio general
        PERFORM public.log_order_event(
          NEW.id,
          NEW.order_number,
          'status_changed',
          'Estado cambiado de ' || OLD.status || ' a ' || NEW.status,
          jsonb_build_object(
            'previous_status', OLD.status,
            'new_status', NEW.status
          )
        );
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para registrar soft delete
CREATE OR REPLACE FUNCTION public.log_order_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Si se está marcando como eliminada (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.log_order_event(
      NEW.id,
      NEW.order_number,
      'deleted',
      'Orden eliminada por administrador',
      jsonb_build_object(
        'deleted_by', NEW.deleted_by,
        'previous_status', OLD.status
      )
    );
  -- Si se está restaurando
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    PERFORM public.log_order_event(
      NEW.id,
      NEW.order_number,
      'restored',
      'Orden restaurada por administrador',
      jsonb_build_object(
        'restored_to_status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear los triggers
CREATE TRIGGER trigger_log_order_creation
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_creation();

CREATE TRIGGER trigger_log_order_status_change_history
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change_history();

CREATE TRIGGER trigger_log_order_deletion
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_deletion();

-- Trigger para registrar firmas
CREATE OR REPLACE FUNCTION public.log_order_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_number TEXT;
BEGIN
  -- Obtener el número de orden
  SELECT o.order_number INTO order_number
  FROM public.orders o
  WHERE o.id = NEW.order_id;
  
  PERFORM public.log_order_event(
    NEW.order_id,
    order_number,
    'signed',
    'Orden firmada por el cliente: ' || NEW.client_name,
    jsonb_build_object(
      'client_name', NEW.client_name,
      'signature_type', 'authorization'
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_order_signature
  AFTER INSERT ON public.order_authorization_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_signature();

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_order_history_order_id ON public.order_history(order_id);
CREATE INDEX idx_order_history_event_type ON public.order_history(event_type);
CREATE INDEX idx_order_history_created_at ON public.order_history(created_at DESC);
CREATE INDEX idx_orders_deleted_at ON public.orders(deleted_at) WHERE deleted_at IS NOT NULL;