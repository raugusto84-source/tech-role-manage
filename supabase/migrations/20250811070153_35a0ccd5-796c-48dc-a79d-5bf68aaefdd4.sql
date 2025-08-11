-- Verificar y actualizar las políticas de RLS para order_chat_messages
-- La política actual permite a los usuarios actualizar solo sus propios mensajes
-- Pero necesitamos que puedan marcar como leídos los mensajes de otros

-- Agregar política para que los usuarios puedan marcar como leídos mensajes en órdenes donde tienen acceso
CREATE POLICY "Users can mark messages as read in their orders" 
ON public.order_chat_messages 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE 
      o.id = order_chat_messages.order_id AND 
      (
        o.assigned_technician = auth.uid() OR 
        p.role = 'administrador'::user_role OR 
        (p.role = 'cliente'::user_role AND c.email = p.email)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE 
      o.id = order_chat_messages.order_id AND 
      (
        o.assigned_technician = auth.uid() OR 
        p.role = 'administrador'::user_role OR 
        (p.role = 'cliente'::user_role AND c.email = p.email)
      )
  )
);