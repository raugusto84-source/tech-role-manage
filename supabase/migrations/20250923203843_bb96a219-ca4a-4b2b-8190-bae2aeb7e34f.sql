-- Fix the trigger function with correct column names
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  policy_monthly_fee NUMERIC;
BEGIN
  -- Get the monthly fee from the insurance_policies table
  SELECT monthly_fee INTO policy_monthly_fee
  FROM public.insurance_policies 
  WHERE id = NEW.policy_id;
  
  -- Create the first monthly payment
  INSERT INTO public.policy_payments (
    policy_client_id,
    amount,
    account_type,
    due_date,
    payment_month,
    payment_year,
    is_paid,
    payment_status
  ) VALUES (
    NEW.id,
    COALESCE(policy_monthly_fee, 0),
    'no_fiscal',
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month',
    EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 month'),
    EXTRACT(YEAR FROM CURRENT_DATE + INTERVAL '1 month'),
    false,
    'pendiente'
  );
  
  RETURN NEW;
END;
$$;