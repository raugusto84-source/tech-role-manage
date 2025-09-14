-- Fix client order approval policies by simplifying and removing conflicts

-- Drop conflicting policies
DROP POLICY IF EXISTS "Clients can approve their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can update their own orders for approval" ON public.orders;

-- Create a single, clear policy for client order updates (approval)
CREATE POLICY "clients_update_own_orders" ON public.orders
FOR UPDATE 
TO authenticated
USING (
  get_user_role_safe() = 'cliente' AND 
  client_id IN (
    SELECT c.id 
    FROM public.clients c 
    WHERE c.user_id = auth.uid()
  )
)
WITH CHECK (
  get_user_role_safe() = 'cliente' AND 
  client_id IN (
    SELECT c.id 
    FROM public.clients c 
    WHERE c.user_id = auth.uid()
  )
);

-- Ensure clients can also view their orders for approval
DROP POLICY IF EXISTS "Clients can view orders for their user_id" ON public.orders;
DROP POLICY IF EXISTS "Clients can view their own orders" ON public.orders;

-- Single comprehensive client view policy
CREATE POLICY "clients_view_own_orders_comprehensive" ON public.orders
FOR SELECT 
TO authenticated
USING (
  get_user_role_safe() = 'cliente' AND 
  client_id IN (
    SELECT c.id 
    FROM public.clients c 
    WHERE c.user_id = auth.uid()
  )
);