-- Configurar ejecución automática de nóminas recurrentes los viernes a las 11 AM hora México
-- Los viernes a las 11 AM hora México (UTC-6) = 17:00 UTC

-- Crear cron job que se ejecuta cada viernes a las 11 AM hora México (17:00 UTC)
-- Formato cron: minuto hora día-del-mes mes día-de-la-semana
-- 0 17 * * 5 = A las 17:00 UTC (11 AM México) todos los viernes (día 5)
SELECT cron.schedule(
  'run-recurring-payrolls-weekly',
  '0 17 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/run-recurring-payrolls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4'
    ),
    body := jsonb_build_object('time', now()::text)
  ) as request_id;
  $$
);