-- Update technician permissions to allow updating all order items
-- First drop the old policy
DROP POLICY IF EXISTS "Technicians can update assigned order items" ON public.order_items;

-- Wait a moment before creating the new one
DO $$ BEGIN
  PERFORM pg_sleep(0.1);
END $$;

-- Create new policy allowing technicians to update all order items
CREATE POLICY "Technicians can update all order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'tecnico'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'tecnico'::user_role
  )
);