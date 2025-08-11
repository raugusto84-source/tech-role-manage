-- Agregar campos para autorización del cliente
ALTER TABLE public.orders 
ADD COLUMN client_approval boolean DEFAULT false,
ADD COLUMN client_approval_notes text,
ADD COLUMN client_approved_at timestamp with time zone,
ADD COLUMN initial_signature_url text;

-- Crear nuevo estado para órdenes pendientes de aprobación
-- Primero necesitamos crear un nuevo enum con el estado adicional
CREATE TYPE order_status_new AS ENUM (
  'pendiente_aprobacion',
  'pendiente', 
  'en_camino', 
  'en_proceso', 
  'finalizada', 
  'cancelada'
);

-- Migrar la columna status al nuevo enum
ALTER TABLE public.orders 
ALTER COLUMN status SET DEFAULT 'pendiente_aprobacion'::order_status_new;

-- Actualizar las referencias existentes
UPDATE public.orders SET status = 'pendiente_aprobacion'::text WHERE status = 'pendiente';

-- Cambiar el tipo de la columna
ALTER TABLE public.orders 
ALTER COLUMN status TYPE order_status_new USING status::order_status_new;

-- Eliminar el enum viejo después de migrar todas las referencias
DROP TYPE IF EXISTS order_status CASCADE;

-- Renombrar el nuevo enum
ALTER TYPE order_status_new RENAME TO order_status;

-- También actualizar order_items para usar el nuevo enum
ALTER TABLE public.order_items 
ALTER COLUMN status TYPE order_status USING 
  CASE 
    WHEN status::text = 'pendiente' THEN 'pendiente'::order_status
    WHEN status::text = 'finalizada' THEN 'finalizada'::order_status
    ELSE 'pendiente'::order_status
  END;

-- También actualizar order_status_logs
ALTER TABLE public.order_status_logs 
ALTER COLUMN new_status TYPE order_status USING new_status::order_status,
ALTER COLUMN previous_status TYPE order_status USING previous_status::order_status;

-- Función para manejar la aprobación del cliente
CREATE OR REPLACE FUNCTION public.approve_order_by_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Solo procesar cuando el cliente aprueba la orden
  IF NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM NEW.client_approval THEN
    -- Cambiar estado a pendiente para que aparezca en el panel de técnicos
    NEW.status := 'pendiente'::order_status;
    NEW.client_approved_at := now();
    
    -- Registrar el cambio en los logs
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      'pendiente_aprobacion'::order_status,
      'pendiente'::order_status,
      auth.uid(),
      'Orden aprobada por el cliente'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para manejar aprobación del cliente
CREATE TRIGGER handle_client_approval
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.approve_order_by_client();

-- Actualizar política RLS para que clientes puedan aprobar sus órdenes
CREATE POLICY "Clients can approve their own orders" 
ON public.orders 
FOR UPDATE 
TO authenticated
USING (
  (get_current_user_role() = 'cliente') AND 
  (client_id IN (
    SELECT id FROM public.clients 
    WHERE email = (
      SELECT email FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  ))
) 
WITH CHECK (
  (get_current_user_role() = 'cliente') AND 
  (client_id IN (
    SELECT id FROM public.clients 
    WHERE email = (
      SELECT email FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  ))
);