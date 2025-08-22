-- Verificar políticas RLS existentes para delivery_signatures
-- y crearlas si no existen

-- Habilitar RLS en la tabla si no está habilitado
ALTER TABLE public.delivery_signatures ENABLE ROW LEVEL SECURITY;

-- Permitir a los clientes insertar firmas para órdenes donde son el cliente
CREATE POLICY IF NOT EXISTS "clients_can_sign_their_orders" 
ON public.delivery_signatures
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE o.id = delivery_signatures.order_id 
    AND p.user_id = auth.uid()
  )
);

-- Permitir al staff ver todas las firmas
CREATE POLICY IF NOT EXISTS "staff_can_view_all_signatures" 
ON public.delivery_signatures
FOR SELECT
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text])
);

-- Permitir a los clientes ver sus propias firmas
CREATE POLICY IF NOT EXISTS "clients_can_view_their_signatures" 
ON public.delivery_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE o.id = delivery_signatures.order_id 
    AND p.user_id = auth.uid()
  )
);