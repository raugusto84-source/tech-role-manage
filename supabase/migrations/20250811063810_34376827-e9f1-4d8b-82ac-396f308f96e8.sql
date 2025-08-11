-- Actualizar la política RLS para que los clientes puedan ver sus propias órdenes correctamente
DROP POLICY IF EXISTS "clients_view_own" ON public.orders;

CREATE POLICY "clients_view_own" ON public.orders
FOR SELECT 
USING (
  (get_user_role_safe() = 'cliente' AND 
   client_id IN (
     SELECT c.id 
     FROM clients c 
     WHERE c.email = (
       SELECT p.email 
       FROM profiles p 
       WHERE p.user_id = auth.uid()
     )
   )) OR
  (get_user_role_safe() = 'administrador') OR
  (get_user_role_safe() = 'vendedor') OR
  (get_user_role_safe() = 'tecnico' AND assigned_technician = auth.uid())
);