-- Drop the existing policy that uses get_current_user_role()
DROP POLICY IF EXISTS "Staff can manage order equipment" ON public.order_equipment;

-- Create new policy that uses profiles.role directly
CREATE POLICY "Staff can manage order equipment" 
ON public.order_equipment 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('administrador', 'supervisor', 'vendedor', 'tecnico', 'jcf')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('administrador', 'supervisor', 'vendedor', 'tecnico', 'jcf')
  )
);