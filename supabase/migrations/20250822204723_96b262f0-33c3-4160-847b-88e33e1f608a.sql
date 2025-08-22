-- Fix the trigger to use the correct field
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS TRIGGER AS $$
DECLARE
  policy_monthly_fee NUMERIC;
BEGIN
  -- Only create the initial payment when assigning an active policy
  IF NEW.is_active = true AND (OLD.is_active IS NULL OR OLD.is_active = false) THEN
    
    -- Get the monthly fee from the insurance policy
    SELECT monthly_fee INTO policy_monthly_fee
    FROM public.insurance_policies 
    WHERE id = NEW.policy_id;
    
    -- Insert the initial payment
    INSERT INTO public.policy_payments (
      policy_client_id,
      amount,
      month,
      year,
      due_date,
      payment_status
    ) VALUES (
      NEW.id,
      policy_monthly_fee,
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
      (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '4 days')::DATE, -- 5th of next month
      'pendiente'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Update the trigger to use the correct function
DROP TRIGGER IF EXISTS create_initial_policy_payment_trigger ON public.policy_clients;
CREATE TRIGGER create_initial_policy_payment_trigger
  AFTER INSERT OR UPDATE ON public.policy_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_policy_payment();