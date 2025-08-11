-- Fix security definer function by setting proper search path
CREATE OR REPLACE FUNCTION public.log_financial_operation(
  p_operation_type TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_record_data JSONB,
  p_operation_description TEXT,
  p_amount NUMERIC,
  p_account_type TEXT DEFAULT NULL,
  p_operation_date DATE DEFAULT CURRENT_DATE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  history_id UUID;
BEGIN
  INSERT INTO public.financial_history (
    operation_type,
    table_name,
    record_id,
    record_data,
    operation_description,
    performed_by,
    amount,
    account_type,
    operation_date
  ) VALUES (
    p_operation_type,
    p_table_name,
    p_record_id,
    p_record_data,
    p_operation_description,
    auth.uid(),
    p_amount,
    p_account_type,
    p_operation_date
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$;