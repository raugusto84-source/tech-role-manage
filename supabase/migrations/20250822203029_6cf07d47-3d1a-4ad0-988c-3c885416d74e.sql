-- Update the trigger to only create the initial payment when assigning a policy
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create the initial payment for the current month when a policy is assigned
  IF NEW.status = 'activa' AND (OLD.status IS NULL OR OLD.status != 'activa') THEN
    INSERT INTO public.policy_payments (
      policy_client_id,
      amount,
      month,
      year,
      due_date,
      status
    ) VALUES (
      NEW.id,
      NEW.monthly_amount,
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
      (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '4 days')::DATE, -- 5th of next month
      'pendiente'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';