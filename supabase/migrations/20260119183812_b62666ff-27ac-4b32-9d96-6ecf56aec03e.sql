-- Fix equipment_brands policy to use profiles.role directly
DROP POLICY IF EXISTS "Staff can manage equipment brands" ON public.equipment_brands;

CREATE POLICY "Staff can manage equipment brands" 
ON public.equipment_brands 
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

-- Fix equipment_models policy to use profiles.role directly
DROP POLICY IF EXISTS "Staff can manage equipment models" ON public.equipment_models;

CREATE POLICY "Staff can manage equipment models" 
ON public.equipment_models 
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