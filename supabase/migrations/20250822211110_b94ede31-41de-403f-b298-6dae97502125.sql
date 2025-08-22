-- Fix create_initial_policy_payment to use correct columns and triggers
-- Drop conflicting triggers
DROP TRIGGER IF EXISTS create_initial_policy_payment_trigger ON public.policy_clients;
DROP TRIGGER IF EXISTS trg_create_initial_policy_payment ON public.policy_clients;
DROP TRIGGER IF EXISTS trg_create_initial_policy_payment_update ON public.policy_clients;

-- Recreate the function with correct schema
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  monthly_fee numeric;
  start_dt date;
  m int;
  y int;
  due_dt date;
  exists_id uuid;
BEGIN
  -- Run on insert or when reactivating assignment
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active)) THEN
    -- Get policy monthly fee
    SELECT ip.monthly_fee INTO monthly_fee
    FROM public.insurance_policies ip
    WHERE ip.id = NEW.policy_id;

    IF monthly_fee IS NULL THEN
      RETURN NEW;
    END IF;

    -- Determine current month/year based on start_date or today
    start_dt := COALESCE(NEW.start_date::date, CURRENT_DATE);
    m := EXTRACT(MONTH FROM start_dt);
    y := EXTRACT(YEAR FROM start_dt);

    -- Due date: 5th day of the same month
    due_dt := make_date(y, m, 5);

    -- Avoid duplicates for the same period
    SELECT id INTO exists_id
    FROM public.policy_payments
    WHERE policy_client_id = NEW.id AND payment_month = m AND payment_year = y;

    IF exists_id IS NULL THEN
      INSERT INTO public.policy_payments (
        policy_client_id, payment_month, payment_year, amount, account_type, due_date, is_paid, payment_status
      ) VALUES (
        NEW.id, m, y, monthly_fee, 'no_fiscal', due_dt, false, 'pendiente'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate precise triggers
CREATE TRIGGER trg_create_initial_policy_payment
AFTER INSERT ON public.policy_clients
FOR EACH ROW EXECUTE FUNCTION public.create_initial_policy_payment();

CREATE TRIGGER trg_create_initial_policy_payment_update
AFTER UPDATE OF is_active ON public.policy_clients
FOR EACH ROW
WHEN (NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active))
EXECUTE FUNCTION public.create_initial_policy_payment();