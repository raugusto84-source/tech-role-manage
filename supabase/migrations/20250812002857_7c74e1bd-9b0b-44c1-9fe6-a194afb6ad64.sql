-- Check current RLS policies for order_chat_messages
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'order_chat_messages';

-- Allow vendors to insert messages for orders they have access to
DROP POLICY IF EXISTS "Users can insert their own messages" ON order_chat_messages;
DROP POLICY IF EXISTS "Users can read messages from their orders" ON order_chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON order_chat_messages;

-- New policy: Users can read messages from orders they have access to
CREATE POLICY "Users can read messages from their orders" ON order_chat_messages
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Client can read messages from their own orders
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_chat_messages.order_id
      AND o.client_id IN (
        SELECT c.id FROM clients c WHERE c.user_id = auth.uid()
      )
    )
    OR
    -- Technician can read messages from orders assigned to them
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_chat_messages.order_id
      AND o.assigned_technician = auth.uid()
    )
    OR
    -- Vendor/Admin can read messages from any order
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('vendedor', 'administrador')
    )
  )
);

-- New policy: Users can insert messages to orders they have access to
CREATE POLICY "Users can insert messages to their orders" ON order_chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  sender_id = auth.uid() AND (
    -- Client can send messages to their own orders
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_chat_messages.order_id
      AND o.client_id IN (
        SELECT c.id FROM clients c WHERE c.user_id = auth.uid()
      )
    )
    OR
    -- Technician can send messages to orders assigned to them
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_chat_messages.order_id
      AND o.assigned_technician = auth.uid()
    )
    OR
    -- Vendor/Admin can send messages to any order
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('vendedor', 'administrador')
    )
  )
);

-- New policy: Users can update read_at status on messages from orders they have access to
CREATE POLICY "Users can mark messages as read" ON order_chat_messages
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    -- Client can update messages from their own orders
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_chat_messages.order_id
      AND o.client_id IN (
        SELECT c.id FROM clients c WHERE c.user_id = auth.uid()
      )
    )
    OR
    -- Technician can update messages from orders assigned to them
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_chat_messages.order_id
      AND o.assigned_technician = auth.uid()
    )
    OR
    -- Vendor/Admin can update messages from any order
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('vendedor', 'administrador')
    )
  )
);