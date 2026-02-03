-- Corregir las órdenes existentes: cambiar fecha de Feb 10 a Feb 2 (esta semana)
UPDATE orders 
SET delivery_date = '2026-02-02',
    failure_description = REPLACE(failure_description, '2026-02-10', '2026-02-02')
WHERE id IN ('18822374-b293-40e9-9d0c-45a7b6343e3d', '7700903b-6af1-4c97-8de5-fe7ca18419b4');

-- Crear orden para Altozano (martes 3 de febrero - hoy)
-- Primero obtenemos info necesaria y creamos la orden

-- Actualizar las fechas next_run para la PRÓXIMA semana (después de crear las órdenes de esta semana)
-- Mayagoitia, Hotel y Casten: próximo lunes 9 de febrero
UPDATE scheduled_services 
SET next_run = '2026-02-09 00:01:00+00',
    next_service_date = '2026-02-09'
WHERE id IN ('69dc2d3f-10b9-489d-9d74-5b9c8bbf2f06', '1431b41c-fcaa-488f-ab76-3a428e4b8a4c', '5a110398-74cf-4f90-9fe5-294fb0040b0b');

-- Altozano: próximo martes 10 de febrero
UPDATE scheduled_services 
SET next_run = '2026-02-10 00:01:00+00',
    next_service_date = '2026-02-10'
WHERE id = '302b1d3f-c03c-4cdc-90c3-fed28243cb7c';

-- Habilitar extensiones necesarias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Crear el cron job para ejecutar cada domingo a las 11pm (hora México CST = 05:00 UTC del lunes)
SELECT cron.schedule(
  'process-scheduled-services-sunday',
  '0 5 * * 1', -- 5:00 AM UTC del lunes = 11:00 PM CST del domingo
  $$
  SELECT net.http_post(
    url := 'https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/process-scheduled-services',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dW5qeWJzZXJtbnh2cnZ5eG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODczNjQsImV4cCI6MjA2OTc2MzM2NH0.TSBiuVJ_eyF8cQ0C0t_9y5LHZwETxpD8vrjtBlea8E4"}'::jsonb,
    body := '{"action": "process_due_services"}'::jsonb
  ) AS request_id;
  $$
);