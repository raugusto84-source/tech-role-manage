-- Arreglar políticas RLS para quote_items para permitir inserción por todos los usuarios autenticados

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Clients can view their own quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Staff can manage quote items" ON public.quote_items;

-- Crear políticas RLS mejoradas para quote_items

-- Política para SELECT: Los clientes pueden ver items de sus cotizaciones, staff puede ver todos
CREATE POLICY "Users can view relevant quote items" 
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

-- Política para INSERT: Usuarios autenticados pueden crear quote items si tienen permiso sobre la cotización
CREATE POLICY "Users can create quote items for accessible quotes" 
ON public.quote_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND (
      -- El usuario es el creador de la cotización
      q.created_by = auth.uid() OR
      -- O es staff
      get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text])
    )
  )
);

-- Política para UPDATE: Solo staff puede actualizar quote items
CREATE POLICY "Staff can update quote items" 
ON public.quote_items 
FOR UPDATE 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));

-- Política para DELETE: Solo staff puede eliminar quote items
CREATE POLICY "Staff can delete quote items" 
ON public.quote_items 
FOR DELETE 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));