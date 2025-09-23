-- Fix the trigger function that creates initial policy payments
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
    due_date,
    payment_month,
    payment_year,
    status
  ) VALUES (
    NEW.id,
    COALESCE(policy_monthly_fee, 0),
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month',
    EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 month'),
    EXTRACT(YEAR FROM CURRENT_DATE + INTERVAL '1 month'),
    'pendiente'
  );
  
  RETURN NEW;
END;
$$;