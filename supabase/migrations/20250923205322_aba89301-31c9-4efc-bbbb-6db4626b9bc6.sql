-- Safeguard: avoid duplicate first payment on re-assignment/reactivation
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  policy_monthly_fee NUMERIC;
  next_month_date DATE;
  next_month INT;
  next_year INT;
BEGIN
  -- Compute next month period (payments are due every day 1)
  next_month_date := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date; -- 1st day next month
  next_month := EXTRACT(MONTH FROM next_month_date);
  next_year  := EXTRACT(YEAR  FROM next_month_date);

  -- Get policy monthly fee
  SELECT monthly_fee INTO policy_monthly_fee
  FROM public.insurance_policies 
  WHERE id = NEW.policy_id;

  -- Insert first payment only if it doesn't exist yet
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
    next_month_date,
    next_month,
    next_year,
    false,
    'pendiente'
  )
  ON CONFLICT (policy_client_id, payment_month, payment_year) DO NOTHING;

  RETURN NEW;
END;
$$;