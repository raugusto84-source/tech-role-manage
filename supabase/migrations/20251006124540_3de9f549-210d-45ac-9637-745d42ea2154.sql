-- Habilitar extensiones necesarias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Eliminar cron job existente si existe
SELECT cron.unschedule('policy-automation-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'policy-automation-daily'
);

-- Crear cron job para ejecutar automatización de políticas diariamente a las 00:01
SELECT cron.schedule(
  'policy-automation-daily',
  '1 0 * * *', -- Ejecutar a las 00:01 todos los días
  $$
  SELECT
    net.http_post(
        url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/policy-automation-engine',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
        body:='{"action": "daily", "force": false}'::jsonb
    ) as request_id;
  $$
);

-- Verificar que el cron job fue creado
SELECT * FROM cron.job WHERE jobname = 'policy-automation-daily';