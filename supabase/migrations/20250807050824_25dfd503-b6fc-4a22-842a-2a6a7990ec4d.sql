-- Hacer el email opcional en la tabla de clientes
ALTER TABLE public.clients 
ALTER COLUMN email DROP NOT NULL;

-- Actualizar las políticas RLS para que funcionen sin email obligatorio
DROP POLICY IF EXISTS "Clients can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can update their own orders" ON public.orders;

-- Crear nuevas políticas más flexibles
CREATE POLICY "Clients can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  (get_current_user_role() = 'cliente' AND (
    -- Permitir si el client_id corresponde al usuario actual por email
    (EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = orders.client_id 
      AND clients.email = (SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid())
    )) OR
    -- Permitir si no hay client_id especificado (se asignará después)
    client_id IS NULL
  )) OR 
  (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]))
);

CREATE POLICY "Clients can view their own orders" 
ON public.orders 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente' AND (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = orders.client_id 
      AND (
        clients.email = (SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid()) OR
        clients.email IS NULL
      )
    )
  )) OR 
  (get_current_user_role() = ANY (ARRAY['administrador'::text, 'tecnico'::text, 'vendedor'::text]))
);

CREATE POLICY "Clients can update their own orders" 
ON public.orders 
FOR UPDATE 
USING (
  (get_current_user_role() = 'cliente' AND (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = orders.client_id 
      AND (
        clients.email = (SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid()) OR
        clients.email IS NULL
      )
    )
  )) OR 
  (get_current_user_role() = ANY (ARRAY['administrador'::text, 'tecnico'::text]))
);