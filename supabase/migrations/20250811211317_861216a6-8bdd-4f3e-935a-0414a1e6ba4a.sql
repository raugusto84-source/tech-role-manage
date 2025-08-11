-- Agregar políticas RLS para fiscal_withdrawals
-- Permitir que usuarios autenticados vean retiros fiscales
CREATE POLICY "Users can view fiscal withdrawals" 
ON public.fiscal_withdrawals 
FOR SELECT 
USING (true);

-- Permitir que usuarios autenticados puedan actualizar el estado de retiro
CREATE POLICY "Users can update fiscal withdrawal status" 
ON public.fiscal_withdrawals 
FOR UPDATE 
USING (true);