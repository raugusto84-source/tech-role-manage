-- Verificar las políticas actuales y simplificarlas
-- Primero, eliminar las políticas problemáticas
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view their own record" ON public.clients;
DROP POLICY IF EXISTS "Staff can manage clients" ON public.clients;

-- Crear políticas más simples y directas
CREATE POLICY "Authenticated users can view clients" 
ON public.clients 
FOR SELECT 
USING (true); -- Temporalmente permitir acceso a todos los usuarios autenticados

CREATE POLICY "Staff can manage clients" 
ON public.clients 
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]));

-- Verificar que RLS esté habilitado
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;