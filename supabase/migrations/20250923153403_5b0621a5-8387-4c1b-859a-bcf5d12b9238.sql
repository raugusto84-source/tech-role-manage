-- Create financial projections table for automation engine
CREATE TABLE IF NOT EXISTS public.financial_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  projected_revenue NUMERIC NOT NULL DEFAULT 0,
  active_contracts INTEGER NOT NULL DEFAULT 0,
  projection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique projections per month/year
  UNIQUE(year, month)
);

-- Enable Row Level Security
ALTER TABLE public.financial_projections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can manage financial projections"
  ON public.financial_projections
  FOR ALL
  USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

CREATE POLICY "Staff can view financial projections"
  ON public.financial_projections
  FOR SELECT
  USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_financial_projections_year_month 
  ON public.financial_projections(year, month);

CREATE INDEX IF NOT EXISTS idx_financial_projections_projection_date 
  ON public.financial_projections(projection_date);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_financial_projections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_financial_projections_updated_at
  BEFORE UPDATE ON public.financial_projections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_financial_projections_updated_at();

-- Enable pg_cron and pg_net extensions for automation scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron jobs for policy automation
-- Daily automation (every day at 6:00 AM)
SELECT cron.schedule(
  'policy-automation-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/policy-automation-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
    body := '{"action": "daily", "force": false}'::jsonb
  ) as request_id;
  $$
);

-- Weekly automation (every Monday at 7:00 AM)
SELECT cron.schedule(
  'policy-automation-weekly',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/policy-automation-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
    body := '{"action": "weekly", "force": false}'::jsonb
  ) as request_id;
  $$
);

-- Monthly automation (1st day of each month at 8:00 AM)
SELECT cron.schedule(
  'policy-automation-monthly',
  '0 8 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/policy-automation-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
    body := '{"action": "monthly", "force": false}'::jsonb  
  ) as request_id;
  $$
);

-- Create a function to check cron job status
CREATE OR REPLACE FUNCTION public.get_automation_cron_status()
RETURNS TABLE(
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::TEXT,
    j.schedule::TEXT,
    j.active,
    j.last_run,
    j.next_run
  FROM cron.job j
  WHERE j.jobname LIKE 'policy-automation%'
  ORDER BY j.jobname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for automation functions
GRANT EXECUTE ON FUNCTION public.get_automation_cron_status() TO authenticated;