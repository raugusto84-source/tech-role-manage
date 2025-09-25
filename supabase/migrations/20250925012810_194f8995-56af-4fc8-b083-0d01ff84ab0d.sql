-- Habilitar extensiones necesarias para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para generar pagos cada día 1ero del mes a las 7:00 AM
-- Eliminar job existente si existe
SELECT cron.unschedule('generate-monthly-policy-payments') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-policy-payments'
);

-- Crear nuevo cron job para ejecutar el día 1 de cada mes a las 7:00 AM (hora del servidor)
SELECT cron.schedule(
  'generate-monthly-policy-payments',
  '0 7 1 * *', -- Minuto=0, Hora=7, Día=1, Mes=*, DíaSemana=* (primer día de cada mes a las 7 AM)
  $$
  SELECT
    net.http_post(
        url:='https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/generate-monthly-payments',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
        body:=concat('{"execution_time": "', now(), '", "type": "scheduled"}')::jsonb
    ) as request_id;
  $$
);