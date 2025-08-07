-- Fix the get_current_user_role function to handle the missing clients table reference
-- The issue is that the function might be trying to access clients table indirectly

-- First, let's fix the function to be more specific and avoid the clients table issue
DROP FUNCTION IF EXISTS public.get_current_user_role();

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO public, auth
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.profiles WHERE user_id = auth.uid()),
    'cliente'::text
  );
$$;

-- Now let's simplify the RLS policies to avoid complex joins that might cause the error
-- Drop all existing order policies and recreate them with simpler logic

DROP POLICY IF EXISTS "Clients can view their own orders" ON orders;
DROP POLICY IF EXISTS "Clients can update their own orders" ON orders;
DROP POLICY IF EXISTS "Technicians can update assigned orders" ON orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON orders;
DROP POLICY IF EXISTS "Admin and sales can create orders" ON orders;
DROP POLICY IF EXISTS "Clients can create their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- Create simplified policies that avoid the clients table reference issue

-- Policy for viewing orders
CREATE POLICY "View orders policy" 
ON orders 
FOR SELECT 
USING (
  CASE 
    WHEN get_current_user_role() = ANY (ARRAY['administrador', 'tecnico', 'vendedor']) THEN true
    WHEN get_current_user_role() = 'cliente' THEN (
      client_id IS NOT NULL AND 
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.email IN (
          SELECT c.email FROM clients c WHERE c.id = orders.client_id
        )
      )
    )
    ELSE false
  END
);

-- Policy for updating orders - simplified for technicians
CREATE POLICY "Update orders policy" 
ON orders 
FOR UPDATE 
USING (
  CASE 
    WHEN get_current_user_role() = 'administrador' THEN true
    WHEN get_current_user_role() = 'tecnico' THEN (assigned_technician = auth.uid())
    WHEN get_current_user_role() = 'cliente' THEN (
      client_id IS NOT NULL AND 
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.email IN (
          SELECT c.email FROM clients c WHERE c.id = orders.client_id
        )
      )
    )
    ELSE false
  END
);

-- Policy for creating orders
CREATE POLICY "Create orders policy" 
ON orders 
FOR INSERT 
WITH CHECK (
  get_current_user_role() = ANY (ARRAY['administrador', 'vendedor', 'cliente'])
);

-- Policy for deleting orders (admin only)
CREATE POLICY "Delete orders policy" 
ON orders 
FOR DELETE 
USING (get_current_user_role() = 'administrador');