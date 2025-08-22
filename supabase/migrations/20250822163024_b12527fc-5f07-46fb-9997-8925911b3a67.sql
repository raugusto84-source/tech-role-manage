-- Enable required extensions for scheduling HTTP calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create trigger to generate the first payment when a policy is assigned
DROP TRIGGER IF EXISTS trg_create_initial_policy_payment ON public.policy_clients;

CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  monthly_fee numeric;
  due_dt date;
  m int;
  y int;
  exists_id uuid;
BEGIN
  -- Fetch monthly fee from the policy
  SELECT ip.monthly_fee INTO monthly_fee
  FROM public.insurance_policies ip
  WHERE ip.id = NEW.policy_id;

  IF monthly_fee IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine due date using start_date or today
  due_dt := COALESCE(NEW.start_date::date, CURRENT_DATE);
  m := EXTRACT(MONTH FROM due_dt);
  y := EXTRACT(YEAR FROM due_dt);

  -- Avoid duplicates for the same month/year
  SELECT id INTO exists_id
  FROM public.policy_payments
  WHERE policy_client_id = NEW.id AND payment_month = m AND payment_year = y;

  IF exists_id IS NULL THEN
    INSERT INTO public.policy_payments (
      policy_client_id, payment_month, payment_year, amount,
      account_type, due_date, is_paid, payment_status
    ) VALUES (
      NEW.id, m, y, monthly_fee,
      'no_fiscal', due_dt, false, 'pendiente'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_initial_policy_payment
AFTER INSERT ON public.policy_clients
FOR EACH ROW EXECUTE FUNCTION public.create_initial_policy_payment();

-- Schedule daily job to ensure monthly payments are generated
select cron.unschedule('generate-policy-payments-daily')
where exists (select 1 from cron.job where jobname = 'generate-policy-payments-daily');

select
  cron.schedule(
    'generate-policy-payments-daily',
    '0 6 * * *', -- every day at 06:00 UTC
    $$
    select net.http_post(
      url := 'https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/generate-policy-payments',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
      body := jsonb_build_object('invoked_at', now())
    )
    $$
  );