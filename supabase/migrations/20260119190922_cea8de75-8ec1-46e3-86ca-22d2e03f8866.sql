-- Recreate the Staff policy for order_equipment to ensure it works correctly
DROP POLICY IF EXISTS "Staff can manage order equipment" ON public.order_equipment;

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