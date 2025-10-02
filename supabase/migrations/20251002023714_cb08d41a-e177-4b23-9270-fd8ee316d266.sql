-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove existing cron job if it exists
SELECT cron.unschedule('process-policy-orders-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-policy-orders-daily'
);

-- Schedule daily processing of policy orders at 00:01
SELECT cron.schedule(
  'process-policy-orders-daily',
  '1 0 * * *', -- Every day at 00:01
  $$
  SELECT net.http_post(
    url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/process-scheduled-services',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
    body:='{"action": "process_due_services"}'::jsonb
  ) as request_id;
  $$
);