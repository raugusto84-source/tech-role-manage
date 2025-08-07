-- Actualizar las políticas RLS para clients
-- Permitir que los clientes vean su propio registro

DROP POLICY IF EXISTS "Everyone can view clients" ON public.clients;

-- Crear políticas más específicas
CREATE POLICY "Staff can view all clients" 
ON public.clients 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]));

CREATE POLICY "Clients can view their own record" 
ON public.clients 
FOR SELECT 
USING (
  get_current_user_role() = 'cliente' AND 
  email = (SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid())
);

-- Mantener la política existente para staff
-- (La política "Staff can manage clients" ya existe)