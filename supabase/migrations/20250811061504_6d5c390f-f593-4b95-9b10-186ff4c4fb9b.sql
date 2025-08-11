-- Verificar y agregar solo los campos que no existen para autorización del cliente
DO $$ 
BEGIN
    -- Agregar client_approval_notes si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'client_approval_notes') THEN
        ALTER TABLE public.orders ADD COLUMN client_approval_notes text;
    END IF;
    
    -- Agregar client_approved_at si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'client_approved_at') THEN
        ALTER TABLE public.orders ADD COLUMN client_approved_at timestamp with time zone;
    END IF;
END $$;

-- Crear nuevo estado para órdenes pendientes de aprobación
-- Verificar si el enum ya tiene el estado pendiente_aprobacion
DO $$
BEGIN
    -- Verificar si el enum ya contiene pendiente_aprobacion
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'order_status' AND e.enumlabel = 'pendiente_aprobacion'
    ) THEN
        -- Agregar el nuevo valor al enum existente
        ALTER TYPE order_status ADD VALUE 'pendiente_aprobacion' BEFORE 'pendiente';
    END IF;
END $$;

-- Cambiar el default para nuevas órdenes
ALTER TABLE public.orders 
ALTER COLUMN status SET DEFAULT 'pendiente_aprobacion'::order_status;

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
    
    -- Registrar el cambio en los logs si la tabla existe
    BEGIN
      INSERT INTO public.order_status_logs (
        order_id,
        previous_status,
        new_status,
        changed_by,
        notes
      ) VALUES (
        NEW.id,
        OLD.status,
        'pendiente'::order_status,
        auth.uid(),
        COALESCE(NEW.client_approval_notes, 'Orden aprobada por el cliente')
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar errores si la tabla no existe o hay problemas de permisos
      NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para manejar aprobación del cliente
DROP TRIGGER IF EXISTS handle_client_approval ON public.orders;
CREATE TRIGGER handle_client_approval
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.approve_order_by_client();

-- Actualizar política RLS para que clientes puedan aprobar sus órdenes
DROP POLICY IF EXISTS "Clients can approve their own orders" ON public.orders;
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