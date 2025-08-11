-- Create table for financial movement history
CREATE TABLE IF NOT EXISTS public.financial_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL, -- 'create', 'delete', 'reverse'
  table_name TEXT NOT NULL, -- 'incomes', 'expenses', 'fixed_expenses', 'recurring_payrolls'
  record_id UUID NOT NULL, -- ID of the affected record
  record_data JSONB NOT NULL, -- Complete record data at time of operation
  operation_description TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  amount NUMERIC NOT NULL, -- Amount for easy filtering/totals
  account_type TEXT, -- fiscal/no_fiscal for easy filtering
  operation_date DATE NOT NULL DEFAULT CURRENT_DATE -- Date when the financial operation occurred
);

-- Enable RLS
ALTER TABLE public.financial_history ENABLE ROW LEVEL SECURITY;

-- Admin can view all history
CREATE POLICY "Admins can view all financial history"
ON public.financial_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'administrador'
  )
);

-- Only system/admins can insert history records
CREATE POLICY "Only admins can manage financial history"
ON public.financial_history
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'administrador'
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_financial_history_date ON public.financial_history(operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_history_table ON public.financial_history(table_name);
CREATE INDEX IF NOT EXISTS idx_financial_history_type ON public.financial_history(operation_type);

-- Function to log financial operations
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