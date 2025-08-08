-- Weekly payroll support with Friday cutoff
-- Add columns to recurring_payrolls safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recurring_payrolls' AND column_name = 'frequency'
  ) THEN
    ALTER TABLE public.recurring_payrolls
      ADD COLUMN frequency text NOT NULL DEFAULT 'weekly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recurring_payrolls' AND column_name = 'cutoff_weekday'
  ) THEN
    ALTER TABLE public.recurring_payrolls
      ADD COLUMN cutoff_weekday integer NOT NULL DEFAULT 5; -- 5 = Friday
  END IF;
END $$;

-- Ensure payrolls has period_week
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'period_week'
  ) THEN
    ALTER TABLE public.payrolls
      ADD COLUMN period_week integer;
  END IF;
END $$;