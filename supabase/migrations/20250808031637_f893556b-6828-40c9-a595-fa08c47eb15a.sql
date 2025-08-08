-- Crear tabla para mensajes de chat por orden
CREATE TABLE public.order_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL, -- ID del usuario que envía el mensaje
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE NULL -- Para marcar como leído
);

-- Habilitar RLS
ALTER TABLE public.order_chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Solo usuarios involucrados en la orden pueden ver/enviar mensajes
-- Los usuarios pueden ver mensajes de órdenes donde son cliente, técnico asignado, o administrador
CREATE POLICY "Users can view messages of their orders" 
ON public.order_chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_id 
    AND (
      o.client_id = auth.uid() -- Cliente de la orden
      OR o.assigned_technician = auth.uid() -- Técnico asignado
      OR p.role = 'administrador' -- Administrador
    )
  )
);

-- Los usuarios pueden enviar mensajes a órdenes donde están involucrados
CREATE POLICY "Users can send messages to their orders" 
ON public.order_chat_messages 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM orders o 
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_id 
    AND (
      o.client_id = auth.uid() -- Cliente de la orden
      OR o.assigned_technician = auth.uid() -- Técnico asignado
      OR p.role = 'administrador' -- Administrador
    )
  )
);

-- Los usuarios pueden actualizar sus propios mensajes (para marcar como leído)
CREATE POLICY "Users can update their own message status" 
ON public.order_chat_messages 
FOR UPDATE 
USING (sender_id = auth.uid());

-- Habilitar realtime para la tabla
ALTER TABLE public.order_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_chat_messages;

-- Crear índices para mejor rendimiento
CREATE INDEX idx_order_chat_messages_order_id ON public.order_chat_messages(order_id);
CREATE INDEX idx_order_chat_messages_created_at ON public.order_chat_messages(created_at DESC);
CREATE INDEX idx_order_chat_messages_sender ON public.order_chat_messages(sender_id);