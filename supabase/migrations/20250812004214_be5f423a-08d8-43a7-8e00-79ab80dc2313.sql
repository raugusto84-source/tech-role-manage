-- Revert RLS policies to original state

-- Revert profiles policies
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can manage profiles" ON profiles;

-- Restore original profiles policies
CREATE POLICY "Users can view all profiles"
ON profiles 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Revert order_support_technicians policies  
DROP POLICY IF EXISTS "Users can view support technicians for accessible orders" ON order_support_technicians;
DROP POLICY IF EXISTS "Staff can manage support technicians" ON order_support_technicians;

-- Restore original order_support_technicians policy
CREATE POLICY "Users can view support technicians for their orders"
ON order_support_technicians 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_support_technicians.order_id
    AND (
      o.assigned_technician = auth.uid() OR
      p.role = 'administrador' OR
      (p.role = 'cliente' AND c.email = p.email)
    )
  )
);

-- Revert orders policies
DROP POLICY IF EXISTS "Users can view accessible orders" ON orders;
DROP POLICY IF EXISTS "Staff can manage all orders" ON orders;
DROP POLICY IF EXISTS "Technicians can update assigned orders" ON orders;
DROP POLICY IF EXISTS "Clients can create orders" ON orders;

-- Restore original orders policies
CREATE POLICY "Staff can manage orders"
ON orders 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'administrador'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'administrador'
  )
);

CREATE POLICY "Users can view their orders"
ON orders 
FOR SELECT 
TO authenticated
USING (
  assigned_technician = auth.uid() OR
  client_id IN (
    SELECT c.id FROM clients c 
    WHERE c.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('administrador', 'vendedor', 'tecnico')
  )
);

-- Add vendor access to technician suggestion functionality
CREATE POLICY "Vendors can view support technicians for suggestions"
ON order_support_technicians 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'vendedor'
  )
);