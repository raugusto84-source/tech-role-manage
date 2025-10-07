-- Update RLS policy for order_items to allow technicians to view all order items
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view order items for their orders" ON public.order_items;

-- Create new policy that allows technicians to view all order items
CREATE POLICY "Users can view order items for their orders" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_items.order_id
    AND (
      -- Technicians can view ALL order items (not just assigned orders)
      p.role = 'tecnico'
      -- Admins, supervisors, and sellers can view all
      OR p.role IN ('administrador', 'supervisor', 'vendedor')
      -- Clients can view their own order items
      OR (p.role = 'cliente' AND c.email = p.email)
    )
  )
);