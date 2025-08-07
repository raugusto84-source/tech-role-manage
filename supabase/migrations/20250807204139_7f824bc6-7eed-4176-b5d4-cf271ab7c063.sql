-- Fix RLS policies for orders table
-- The issue is that the client-related policies are interfering with technician updates

-- Drop the problematic policies that are causing the "clients" relation issue
DROP POLICY IF EXISTS "Clients can update their own orders" ON orders;
DROP POLICY IF EXISTS "Clients can view their own orders" ON orders;

-- Recreate client policies with better conditions to avoid conflicts
CREATE POLICY "Clients can view their own orders" 
ON orders 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente' AND 
   client_id IN (
     SELECT id FROM clients 
     WHERE email = (SELECT email FROM profiles WHERE user_id = auth.uid())
   )) 
  OR 
  (get_current_user_role() = ANY (ARRAY['administrador', 'tecnico', 'vendedor']))
);

CREATE POLICY "Clients can update their own orders" 
ON orders 
FOR UPDATE 
USING (
  (get_current_user_role() = 'cliente' AND 
   client_id IN (
     SELECT id FROM clients 
     WHERE email = (SELECT email FROM profiles WHERE user_id = auth.uid())
   )) 
  OR 
  (get_current_user_role() = ANY (ARRAY['administrador', 'tecnico']))
);

-- Make sure technician policies are working correctly
-- Drop and recreate the technician update policy to ensure it has priority
DROP POLICY IF EXISTS "Admin and techs can update orders" ON orders;

CREATE POLICY "Technicians can update assigned orders" 
ON orders 
FOR UPDATE 
USING (
  get_current_user_role() = ANY (ARRAY['administrador', 'tecnico']) AND
  (assigned_technician = auth.uid() OR get_current_user_role() = 'administrador')
);