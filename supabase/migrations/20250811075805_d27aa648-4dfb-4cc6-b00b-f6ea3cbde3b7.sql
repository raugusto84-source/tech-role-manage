-- Arreglar políticas RLS para quote_items para que sean visibles por clientes y staff

-- Eliminar políticas conflictivas existentes
DROP POLICY IF EXISTS "Everyone can view quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Clients can view their quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Admins and sales can manage quote items" ON public.quote_items;

-- Crear nuevas políticas RLS para quote_items
-- Los clientes pueden ver los items de sus propias cotizaciones
CREATE POLICY "Clients can view their own quote items" 
ON public.quote_items 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente' AND EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND q.client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  )) OR
  (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]))
);

-- Solo staff puede gestionar quote items (crear, actualizar, eliminar)
CREATE POLICY "Staff can manage quote items" 
ON public.quote_items 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));