-- Corregir las políticas RLS para order_chat_messages
-- Primero eliminar las políticas existentes
DROP POLICY IF EXISTS "Users can send messages to their orders" ON order_chat_messages;
DROP POLICY IF EXISTS "Users can view messages of their orders" ON order_chat_messages;

-- Crear nuevas políticas correctas
CREATE POLICY "Users can send messages to their orders" 
ON order_chat_messages FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_chat_messages.order_id 
    AND (
      o.assigned_technician = auth.uid() OR 
      p.role = 'administrador'::user_role OR
      (p.role = 'cliente'::user_role AND c.email = p.email)
    )
  )
);

CREATE POLICY "Users can view messages of their orders" 
ON order_chat_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_chat_messages.order_id 
    AND (
      o.assigned_technician = auth.uid() OR 
      p.role = 'administrador'::user_role OR
      (p.role = 'cliente'::user_role AND c.email = p.email)
    )
  )
);