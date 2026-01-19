-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Staff can manage equipment brands" ON public.equipment_brands;
DROP POLICY IF EXISTS "Staff can manage equipment models" ON public.equipment_models;
DROP POLICY IF EXISTS "Staff can manage order equipment" ON public.order_equipment;
DROP POLICY IF EXISTS "Users can view equipment for their orders" ON public.order_equipment;

-- Recreate policies with jcf and tecnico roles included

-- Equipment brands - allow jcf and tecnico to manage
CREATE POLICY "Staff can manage equipment brands" ON public.equipment_brands
FOR ALL USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'jcf'::text, 'tecnico'::text])
);

-- Equipment models - allow jcf and tecnico to manage
CREATE POLICY "Staff can manage equipment models" ON public.equipment_models
FOR ALL USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'jcf'::text, 'tecnico'::text])
);

-- Order equipment - allow jcf to manage
CREATE POLICY "Staff can manage order equipment" ON public.order_equipment
FOR ALL USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text, 'jcf'::text])
);

-- Order equipment view - include jcf role
CREATE POLICY "Users can view equipment for their orders" ON public.order_equipment
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_equipment.order_id
    AND (
      o.assigned_technician = auth.uid()
      OR p.role = 'administrador'
      OR p.role = 'vendedor'
      OR p.role = 'supervisor'
      OR p.role = 'jcf'
      OR p.role = 'tecnico'
      OR (p.role = 'cliente' AND c.email = p.email)
    )
  )
);