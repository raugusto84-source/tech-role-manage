-- Agregar campos de factura a tablas incomes y expenses
ALTER TABLE public.incomes 
ADD COLUMN invoice_number TEXT,
ADD COLUMN has_invoice BOOLEAN DEFAULT false;

-- Actualizar registros existentes - los fiscales existentes asumimos que tienen factura
UPDATE public.incomes 
SET has_invoice = true 
WHERE account_type = 'fiscal';

UPDATE public.incomes 
SET has_invoice = false 
WHERE account_type = 'no_fiscal';

-- Agregar campos de factura a expenses
ALTER TABLE public.expenses 
ADD COLUMN invoice_number TEXT,
ADD COLUMN has_invoice BOOLEAN DEFAULT false;

-- Actualizar registros existentes - los fiscales existentes asumimos que tienen factura
UPDATE public.expenses 
SET has_invoice = true 
WHERE account_type = 'fiscal';

UPDATE public.expenses 
SET has_invoice = false 
WHERE account_type = 'no_fiscal';

-- Crear función para validar facturas fiscales
CREATE OR REPLACE FUNCTION validate_fiscal_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Si es cuenta fiscal, debe tener factura y número de factura
  IF NEW.account_type = 'fiscal' THEN
    IF NEW.has_invoice = false OR NEW.invoice_number IS NULL OR trim(NEW.invoice_number) = '' THEN
      RAISE EXCEPTION 'Las transacciones fiscales requieren factura y número de factura válido';
    END IF;
  END IF;
  
  -- Si no es fiscal, no debe tener número de factura
  IF NEW.account_type = 'no_fiscal' AND NEW.has_invoice = true THEN
    RAISE EXCEPTION 'Las transacciones no fiscales no pueden tener factura';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a incomes
CREATE TRIGGER validate_income_invoice
  BEFORE INSERT OR UPDATE ON public.incomes
  FOR EACH ROW
  EXECUTE FUNCTION validate_fiscal_invoice();

-- Aplicar trigger a expenses  
CREATE TRIGGER validate_expense_invoice
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION validate_fiscal_invoice();

-- Comentarios para documentación
COMMENT ON COLUMN public.incomes.invoice_number IS 'Número de factura requerido para cuentas fiscales';
COMMENT ON COLUMN public.incomes.has_invoice IS 'Indica si la transacción tiene factura asociada';
COMMENT ON COLUMN public.expenses.invoice_number IS 'Número de factura requerido para cuentas fiscales';
COMMENT ON COLUMN public.expenses.has_invoice IS 'Indica si la transacción tiene factura asociada';