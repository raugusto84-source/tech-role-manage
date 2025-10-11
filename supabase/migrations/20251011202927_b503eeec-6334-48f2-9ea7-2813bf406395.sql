-- Configure cron jobs for financial notifications and cache updates

-- 1. Update collections cache every 15 minutes
SELECT cron.schedule(
  'update-collections-cache',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/update-collections-cache',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb
  ) as request_id;
  $$
);

-- 2. Check fiscal withdrawals daily at 9:00 AM
SELECT cron.schedule(
  'check-fiscal-withdrawals',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/check-fiscal-withdrawals',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb
  ) as request_id;
  $$
);

-- 3. Check overdue loans daily at 9:00 AM
SELECT cron.schedule(
  'check-overdue-loans',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/check-overdue-loans',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb
  ) as request_id;
  $$
);

-- 4. Check unpaid payrolls daily at 9:00 AM
SELECT cron.schedule(
  'check-unpaid-payrolls',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/check-unpaid-payrolls',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb
  ) as request_id;
  $$
);

-- 5. Check pending collections daily at 9:00 AM
SELECT cron.schedule(
  'check-pending-collections',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/check-pending-collections',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb
  ) as request_id;
  $$
);

-- 6. Calculate VAT status weekly on Mondays at 9:00 AM
SELECT cron.schedule(
  'calculate-vat-status',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/calculate-vat-status',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb
  ) as request_id;
  $$
);