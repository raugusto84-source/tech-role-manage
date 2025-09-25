-- Add flexible scheduling to policy clients and scheduled services

-- Policy clients billing schedule
ALTER TABLE public.policy_clients
  ADD COLUMN IF NOT EXISTS billing_frequency_type text NOT NULL DEFAULT 'monthly_on_day' CHECK (billing_frequency_type IN ('minutes','days','monthly_on_day')),
  ADD COLUMN IF NOT EXISTS billing_frequency_value integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS next_billing_run timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_policy_clients_next_billing_run
  ON public.policy_clients(next_billing_run);

-- Scheduled services flexible schedule
ALTER TABLE public.scheduled_services
  ADD COLUMN IF NOT EXISTS frequency_type text NOT NULL DEFAULT 'days' CHECK (frequency_type IN ('minutes','days','monthly_on_day')),
  ADD COLUMN IF NOT EXISTS frequency_value integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS next_run timestamptz NOT NULL DEFAULT now();

-- Backfill from existing columns when present
UPDATE public.scheduled_services
SET frequency_value = COALESCE(frequency_days, 30),
    next_run = COALESCE(next_service_date::timestamptz, now())
WHERE (frequency_value IS NULL OR next_run IS NULL);

CREATE INDEX IF NOT EXISTS idx_scheduled_services_next_run
  ON public.scheduled_services(next_run);
