-- Clean up and recreate RLS policies for purchases and expenses

-- Drop ALL existing policies for purchases
DROP POLICY IF EXISTS "Staff can select purchases" ON public.purchases;
DROP POLICY IF EXISTS "Staff can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Staff can update purchases" ON public.purchases;
DROP POLICY IF EXISTS "Staff can delete purchases" ON public.purchases;
DROP POLICY IF EXISTS "Staff can manage purchases" ON public.purchases;

-- Drop ALL existing policies for expenses  
DROP POLICY IF EXISTS "Staff can select expenses" ON public.expenses;
DROP POLICY IF EXISTS "Staff can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Staff can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Staff can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Staff can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins and supervisors can manage all expenses" ON public.expenses;

-- Create new policies for purchases
CREATE POLICY "Staff can select purchases"
ON public.purchases
FOR SELECT
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text, 'supervisor'::text])
);

CREATE POLICY "Staff can insert purchases"
ON public.purchases
FOR INSERT
WITH CHECK (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text, 'supervisor'::text])
);

CREATE POLICY "Staff can update purchases"
ON public.purchases
FOR UPDATE
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text, 'supervisor'::text])
)
WITH CHECK (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text, 'supervisor'::text])
);

CREATE POLICY "Staff can delete purchases"
ON public.purchases
FOR DELETE
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text, 'supervisor'::text])
);

-- Create new policies for expenses
CREATE POLICY "Staff can select expenses"
ON public.expenses
FOR SELECT
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text])
);

CREATE POLICY "Staff can insert expenses"
ON public.expenses
FOR INSERT
WITH CHECK (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text])
);

CREATE POLICY "Staff can update expenses"
ON public.expenses
FOR UPDATE
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text])
)
WITH CHECK (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text])
);

CREATE POLICY "Staff can delete expenses"
ON public.expenses
FOR DELETE
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text])
);