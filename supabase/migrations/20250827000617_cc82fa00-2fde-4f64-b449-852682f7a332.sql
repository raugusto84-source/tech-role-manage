-- Create audit table for financial operations
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation_type TEXT NOT NULL, -- create, update, delete, reverse
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_reason TEXT,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for financial audit logs
CREATE POLICY "Admins can manage financial audit logs" 
ON public.financial_audit_logs 
FOR ALL
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view financial audit logs" 
ON public.financial_audit_logs 
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

-- Create function to log financial operations
CREATE OR REPLACE FUNCTION public.log_financial_operation(
  p_table_name TEXT,
  p_record_id UUID,
  p_operation_type TEXT,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.financial_audit_logs (
    table_name,
    record_id, 
    operation_type,
    old_data,
    new_data,
    changed_by,
    change_reason,
    metadata
  ) VALUES (
    p_table_name,
    p_record_id,
    p_operation_type,
    p_old_data,
    p_new_data,
    auth.uid(),
    p_change_reason,
    p_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Update fiscal withdrawal validation to allow proper invoice validation
CREATE OR REPLACE FUNCTION public.validate_fiscal_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- For fiscal accounts, require invoice and invoice number
  IF NEW.account_type = 'fiscal' THEN
    -- Allow withdrawals from fiscal_withdrawals table without invoice requirement
    -- since they represent money already in fiscal account
    IF TG_TABLE_NAME = 'fiscal_withdrawals' THEN
      RETURN NEW;
    END IF;
    
    -- For other operations, require invoice
    IF NEW.has_invoice = false OR NEW.invoice_number IS NULL OR trim(NEW.invoice_number) = '' THEN
      RAISE EXCEPTION 'Las transacciones fiscales requieren factura y número de factura válido';
    END IF;
  END IF;
  
  -- Non-fiscal accounts cannot have invoices
  IF NEW.account_type = 'no_fiscal' AND NEW.has_invoice = true THEN
    RAISE EXCEPTION 'Las transacciones no fiscales no pueden tener factura';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for expenses audit logging
CREATE OR REPLACE FUNCTION public.expenses_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_financial_operation(
      'expenses',
      NEW.id,
      'create',
      NULL,
      to_jsonb(NEW),
      'Expense created'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_financial_operation(
      'expenses', 
      NEW.id,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Expense updated'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_financial_operation(
      'expenses',
      OLD.id,
      'delete',
      to_jsonb(OLD),
      NULL,
      'Expense deleted'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for incomes audit logging
CREATE OR REPLACE FUNCTION public.incomes_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_financial_operation(
      'incomes',
      NEW.id,
      'create',
      NULL,
      to_jsonb(NEW),
      'Income created'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_financial_operation(
      'incomes',
      NEW.id,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Income updated'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_financial_operation(
      'incomes',
      OLD.id,
      'delete',
      to_jsonb(OLD),
      NULL,
      'Income deleted'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers for audit logging
DROP TRIGGER IF EXISTS expenses_audit ON public.expenses;
CREATE TRIGGER expenses_audit
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.expenses_audit_trigger();

DROP TRIGGER IF EXISTS incomes_audit ON public.incomes;  
CREATE TRIGGER incomes_audit
AFTER INSERT OR UPDATE OR DELETE ON public.incomes
FOR EACH ROW EXECUTE FUNCTION public.incomes_audit_trigger();

-- Add delete capability to collections
CREATE POLICY "Admins can delete order payments" 
ON public.order_payments 
FOR DELETE
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

-- Update service_types to include home service
INSERT INTO public.service_types (name, description, cost_price, base_price, estimated_hours, vat_rate, item_type, category, is_active)
VALUES ('Servicio a Domicilio', 'Tiempo adicional por traslado al domicilio del cliente', 0, 50000, 1, 19, 'servicio', 'traslado', true)
ON CONFLICT (name) DO NOTHING;