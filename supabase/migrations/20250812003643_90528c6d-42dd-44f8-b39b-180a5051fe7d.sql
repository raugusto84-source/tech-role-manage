-- Update RLS policies for profiles table to allow vendors to view technician profiles
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view technician profiles" ON profiles;

-- Create comprehensive policies for profiles
CREATE POLICY "Authenticated users can view all profiles"
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

CREATE POLICY "Staff can manage profiles"
ON profiles 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('administrador', 'vendedor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('administrador', 'vendedor')
  )
);

-- Update RLS policies for order_support_technicians to allow vendors to view
DROP POLICY IF EXISTS "Users can view support technicians for their orders" ON order_support_technicians;

CREATE POLICY "Users can view support technicians for accessible orders"
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
      p.role = 'vendedor' OR
      (p.role = 'cliente' AND c.email = p.email)
    )
  )
);

CREATE POLICY "Staff can manage support technicians"
ON order_support_technicians 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('administrador', 'vendedor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('administrador', 'vendedor')
  )
);

-- Update the orders table policies to ensure vendors have full access
DROP POLICY IF EXISTS "Staff can manage orders" ON orders;
DROP POLICY IF EXISTS "Users can view their orders" ON orders;

CREATE POLICY "Users can view accessible orders"
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

CREATE POLICY "Staff can manage all orders"
ON orders 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('administrador', 'vendedor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('administrador', 'vendedor')
  )
);

CREATE POLICY "Technicians can update assigned orders"
ON orders 
FOR UPDATE 
TO authenticated
USING (
  assigned_technician = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'tecnico'
  )
)
WITH CHECK (
  assigned_technician = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'tecnico'
  )
);

CREATE POLICY "Clients can create orders"
ON orders 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'cliente'
  )
);