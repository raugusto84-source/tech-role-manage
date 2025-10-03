-- Update due date logic to always use day 5 of the payment month
-- 1) Fix initial payment trigger to set due_date to the 5th of the current month
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  policy_data RECORD;
  current_month INTEGER;
  current_year INTEGER;
BEGIN
  -- Only create payment if the assignment is new and active
  IF NEW.is_active = true AND (OLD IS NULL OR OLD.is_active = false) THEN
    -- Get policy info
    SELECT monthly_fee, policy_name
    INTO policy_data
    FROM public.insurance_policies 
    WHERE id = NEW.policy_id;

    -- Current month and year
    current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);

    -- Create initial payment for current month with due date on day 5
    INSERT INTO public.policy_payments (
      policy_client_id,
      amount,
      payment_month,
      payment_year,
      due_date,
      payment_status,
      is_paid,
      account_type,
      created_by
    ) VALUES (
      NEW.id,
      policy_data.monthly_fee,
      current_month,
      current_year,
      make_date(current_year, current_month, 5),
      'pendiente',
      false,
      'no_fiscal',
      NEW.created_by
    )
    ON CONFLICT (policy_client_id, payment_month, payment_year) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Fix monthly generation RPC to set due_date to the 5th of the generated month
CREATE OR REPLACE FUNCTION public.generate_monthly_policy_payments()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  policy_client_record RECORD;
  next_month INTEGER;
  next_year INTEGER;  
  payments_created INTEGER := 0;
  payments_skipped INTEGER := 0;
  result_json json;
BEGIN
  -- Calculate next month/year
  IF EXTRACT(MONTH FROM CURRENT_DATE) = 12 THEN
    next_month := 1;
    next_year := EXTRACT(YEAR FROM CURRENT_DATE) + 1;
  ELSE
    next_month := EXTRACT(MONTH FROM CURRENT_DATE) + 1;
    next_year := EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
  
  -- Generate payments for all active policy clients
  FOR policy_client_record IN
    SELECT 
      pc.id as policy_client_id,
      pc.created_by,
      ip.monthly_fee,
      ip.policy_name,
      c.name as client_name
    FROM public.policy_clients pc
    JOIN public.insurance_policies ip ON ip.id = pc.policy_id
    JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.is_active = true 
      AND ip.is_active = true
  LOOP
    -- Skip if a payment already exists for the target month/year
    IF NOT EXISTS (
      SELECT 1 FROM public.policy_payments 
      WHERE policy_client_id = policy_client_record.policy_client_id
        AND payment_month = next_month 
        AND payment_year = next_year
    ) THEN
      -- Create payment with due date on day 5 of that month
      INSERT INTO public.policy_payments (
        policy_client_id,
        amount,
        payment_month,
        payment_year,
        due_date,
        payment_status,
        is_paid,
        account_type,
        created_by
      ) VALUES (
        policy_client_record.policy_client_id,
        policy_client_record.monthly_fee,
        next_month,
        next_year,
        make_date(next_year, next_month, 5),
        'pendiente',
        false,
        'no_fiscal',
        policy_client_record.created_by
      );
      payments_created := payments_created + 1;
    ELSE
      payments_skipped := payments_skipped + 1;
    END IF;
  END LOOP;
  
  -- Mark overdue pending payments
  UPDATE public.policy_payments 
  SET payment_status = 'vencido'
  WHERE due_date < CURRENT_DATE 
    AND payment_status = 'pendiente' 
    AND is_paid = false;
  
  -- Result
  result_json := json_build_object(
    'success', true,
    'payments_created', payments_created,
    'payments_skipped', payments_skipped,
    'next_month', next_month,
    'next_year', next_year,
    'execution_date', CURRENT_TIMESTAMP
  );
  
  RETURN result_json;
END;
$$;