-- Arreglar políticas RLS para la tabla quotes para permitir que clientes creen cotizaciones

-- Eliminar políticas existentes problemáticas
DROP POLICY IF EXISTS "Users can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Staff can manage quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can view their quotes" ON public.quotes;

-- Crear nuevas políticas RLS más permisivas para quotes
-- Los clientes pueden crear cotizaciones
CREATE POLICY "Clients can create quotes" 
ON public.quotes 
FOR INSERT 
WITH CHECK (
  (get_current_user_role() = 'cliente' AND client_email = (SELECT email FROM profiles WHERE user_id = auth.uid())) OR
  (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]))
);

-- Los usuarios pueden ver sus propias cotizaciones o todas si son staff
CREATE POLICY "Users can view relevant quotes" 
ON public.quotes 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente' AND client_email = (SELECT email FROM profiles WHERE user_id = auth.uid())) OR
  (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]))
);

-- Solo staff puede actualizar cotizaciones
CREATE POLICY "Staff can update quotes" 
ON public.quotes 
FOR UPDATE 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));

-- Solo staff puede eliminar cotizaciones
CREATE POLICY "Staff can delete quotes" 
ON public.quotes 
FOR DELETE 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));