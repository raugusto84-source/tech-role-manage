-- Agregar políticas de eliminación para préstamos y pagos

-- Políticas para loans
CREATE POLICY "Admins can delete loans"
ON public.loans
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'administrador');

-- Políticas para loan_payments
CREATE POLICY "Admins can delete loan payments"
ON public.loan_payments
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'administrador');