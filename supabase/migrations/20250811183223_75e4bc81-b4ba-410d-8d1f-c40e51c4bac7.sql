-- Fix the function search path security warning
CREATE OR REPLACE FUNCTION public.create_fiscal_withdrawal_on_income()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create withdrawal for fiscal incomes
  IF NEW.account_type = 'fiscal' THEN
    INSERT INTO public.fiscal_withdrawals (
      income_id,
      order_id,
      amount,
      description,
      withdrawal_status
    ) VALUES (
      NEW.id,
      NEW.project_id, -- Assuming project_id links to orders
      NEW.amount,
      'Retiro disponible: ' || NEW.description,
      'available'
    );
  END IF;
  
  RETURN NEW;
END;
$$;