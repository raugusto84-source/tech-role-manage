-- Fix client-user relationship: update clients table to link existing clients with their users
UPDATE clients 
SET user_id = profiles.user_id 
FROM profiles 
WHERE clients.email = profiles.email 
  AND profiles.role = 'cliente' 
  AND clients.user_id IS NULL;

-- Ensure RLS policy for clients reading orders is correct
DROP POLICY IF EXISTS "Clients can view orders for their user_id" ON orders;
CREATE POLICY "Clients can view orders for their user_id" ON orders
  FOR SELECT 
  USING (
    (get_current_user_role() = 'cliente' AND EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = orders.client_id 
        AND (c.user_id = auth.uid() OR c.email = (
          SELECT email FROM profiles WHERE user_id = auth.uid()
        ))
    )) OR 
    get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico'])
  );