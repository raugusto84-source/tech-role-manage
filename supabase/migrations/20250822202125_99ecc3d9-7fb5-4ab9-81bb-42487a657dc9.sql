-- Unschedule previous job if it exists
DO $$
DECLARE
  job_id INT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'generate-monthly-policy-payments';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- Schedule job to run on the 1st day of each month at midnight (00:00)
SELECT cron.schedule(
  'generate-monthly-policy-payments',
  '0 0 1 * *',
  $$
  SELECT
    net.http_post(
      url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/generate-policy-payments',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
      body:='{"generate_immediate": false}'::jsonb
    ) as request_id;
  $$
);