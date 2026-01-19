-- Agregar política para que técnicos puedan crear órdenes
CREATE POLICY "technicians_create_orders" 
ON public.orders 
FOR INSERT 
TO public 
WITH CHECK (get_user_role_safe() = 'tecnico');

-- Agregar política para que JCF pueda crear órdenes
CREATE POLICY "jcf_create_orders" 
ON public.orders 
FOR INSERT 
TO authenticated 
WITH CHECK (has_role(auth.uid(), 'jcf'));

-- Agregar política para que JCF pueda actualizar órdenes
CREATE POLICY "jcf_update_orders" 
ON public.orders 
FOR UPDATE 
TO authenticated 
USING (has_role(auth.uid(), 'jcf'))
WITH CHECK (has_role(auth.uid(), 'jcf'));

-- Agregar política para que técnicos puedan actualizar sus propias órdenes creadas
CREATE POLICY "technicians_update_created_orders" 
ON public.orders 
FOR UPDATE 
TO public 
USING (get_user_role_safe() = 'tecnico' AND created_by = auth.uid())
WITH CHECK (get_user_role_safe() = 'tecnico' AND created_by = auth.uid());