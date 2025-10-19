-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to process scheduled services every Sunday at 16:05 PM (4:05 PM)
-- Cron syntax: minute hour day-of-month month day-of-week
-- Day 0 = Sunday
SELECT cron.schedule(
  'process-scheduled-services-sunday',
  '5 16 * * 0',
  $$
  SELECT
    net.http_post(
        url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/process-scheduled-services',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
        body:=concat('{"action": "process_due_services", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);