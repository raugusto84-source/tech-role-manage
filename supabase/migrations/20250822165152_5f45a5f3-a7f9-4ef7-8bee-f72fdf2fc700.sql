-- Schedule daily job to process scheduled services and create orders
select cron.unschedule('process-scheduled-services-daily')
where exists (select 1 from cron.job where jobname = 'process-scheduled-services-daily');

select
  cron.schedule(
    'process-scheduled-services-daily',
    '0 7 * * *', -- every day at 07:00 UTC
    $$
    select net.http_post(
      url := 'https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/process-scheduled-services',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
      body := jsonb_build_object('invoked_at', now())
    )
    $$
  );