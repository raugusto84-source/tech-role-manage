-- Actualizar política RLS de expenses para incluir vendedores y técnicos
-- Esto permitirá que vean las compras que registran

DROP POLICY IF EXISTS "Admins and supervisors can manage all expenses" ON public.expenses;

CREATE POLICY "Staff can manage expenses"
ON public.expenses
FOR ALL
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text])
);