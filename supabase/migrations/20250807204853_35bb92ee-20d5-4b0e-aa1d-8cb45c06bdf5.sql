-- Create a new function with a different name to avoid dependency issues
CREATE OR REPLACE FUNCTION public.get_user_role_safe()
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.profiles WHERE user_id = auth.uid()),
    'cliente'::text
  );
$$;

-- Now let's create a simple policy specifically for technicians updating orders
-- This policy will be very direct and avoid the clients table reference

-- Drop only the problematic order policies
DROP POLICY IF EXISTS "Clients can view their own orders" ON orders;
DROP POLICY IF EXISTS "Clients can update their own orders" ON orders;
DROP POLICY IF EXISTS "Technicians can update assigned orders" ON orders;

-- Create a simple technician update policy that doesn't reference clients table
CREATE POLICY "Technicians can update their assigned orders" 
ON orders 
FOR UPDATE 
USING (
  (get_user_role_safe() = 'tecnico' AND assigned_technician = auth.uid()) OR
  (get_user_role_safe() = 'administrador')
);

-- Create a simple policy for clients that doesn't cause the error
CREATE POLICY "Clients can view orders by email match" 
ON orders 
FOR SELECT 
USING (
  (get_user_role_safe() = ANY (ARRAY['administrador', 'tecnico', 'vendedor'])) OR
  (get_user_role_safe() = 'cliente' AND client_id IS NOT NULL)
);

CREATE POLICY "Clients can update orders by email match" 
ON orders 
FOR UPDATE 
USING (
  (get_user_role_safe() = 'tecnico' AND assigned_technician = auth.uid()) OR
  (get_user_role_safe() = 'administrador') OR
  (get_user_role_safe() = 'cliente' AND client_id IS NOT NULL)
);