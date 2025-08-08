-- Eliminar la vista anterior que causaba el problema de seguridad
DROP VIEW IF EXISTS public.vat_summary;

-- Recrear la vista sin security definer
CREATE VIEW public.vat_summary AS
SELECT 
  DATE_TRUNC('month', transaction_date)::date as period,
  SUM(CASE WHEN transaction_type = 'ingresos' THEN vat_amount ELSE 0 END) as vat_collected,
  SUM(CASE WHEN transaction_type = 'egresos' THEN vat_amount ELSE 0 END) as vat_paid,
  SUM(CASE WHEN transaction_type = 'ingresos' THEN vat_amount ELSE 0 END) - 
  SUM(CASE WHEN transaction_type = 'egresos' THEN vat_amount ELSE 0 END) as vat_balance
FROM public.vat_management
GROUP BY DATE_TRUNC('month', transaction_date)
ORDER BY period DESC;

-- Habilitar RLS en la vista también
ALTER VIEW public.vat_summary SET (security_invoker = on);

-- Crear policy para la vista 
CREATE POLICY "Staff can view VAT summary"
ON public.vat_management
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor']));