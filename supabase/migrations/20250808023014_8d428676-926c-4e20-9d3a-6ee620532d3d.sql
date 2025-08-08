-- Crear tabla para gestión de IVA
CREATE TABLE public.vat_management (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('ingresos', 'egresos')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  vat_rate NUMERIC NOT NULL DEFAULT 16,
  vat_amount NUMERIC GENERATED ALWAYS AS (amount * vat_rate / 100) STORED,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_type account_type NOT NULL DEFAULT 'fiscal',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.vat_management ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para vat_management
CREATE POLICY "Admins can manage VAT records"
ON public.vat_management
FOR ALL
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view VAT records"
ON public.vat_management
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor']));

-- Trigger para updated_at
CREATE TRIGGER update_vat_management_updated_at
BEFORE UPDATE ON public.vat_management
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear vista para el resumen de IVA
CREATE VIEW public.vat_summary AS
SELECT 
  DATE_TRUNC('month', transaction_date) as period,
  SUM(CASE WHEN transaction_type = 'ingresos' THEN vat_amount ELSE 0 END) as vat_collected,
  SUM(CASE WHEN transaction_type = 'egresos' THEN vat_amount ELSE 0 END) as vat_paid,
  SUM(CASE WHEN transaction_type = 'ingresos' THEN vat_amount ELSE 0 END) - 
  SUM(CASE WHEN transaction_type = 'egresos' THEN vat_amount ELSE 0 END) as vat_balance
FROM public.vat_management
GROUP BY DATE_TRUNC('month', transaction_date)
ORDER BY period DESC;