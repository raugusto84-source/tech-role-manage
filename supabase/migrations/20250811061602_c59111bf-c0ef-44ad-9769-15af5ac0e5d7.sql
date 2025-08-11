-- Paso 2: Completar la configuración del sistema de aprobación
-- Cambiar el default para nuevas órdenes
ALTER TABLE public.orders 
ALTER COLUMN status SET DEFAULT 'pendiente_aprobacion'::order_status;

-- Agregar campos faltantes si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'client_approval_notes') THEN
        ALTER TABLE public.orders ADD COLUMN client_approval_notes text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'client_approved_at') THEN
        ALTER TABLE public.orders ADD COLUMN client_approved_at timestamp with time zone;
    END IF;
END $$;

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
      OLD.status,
      'pendiente'::order_status,
      auth.uid(),
      COALESCE(NEW.client_approval_notes, 'Orden aprobada por el cliente')
    );
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

-- Política RLS para que clientes puedan aprobar sus órdenes
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