
-- Actualizar las fechas de los servicios programados que están atrasados
-- Mayagoitia (lunes cada semana), Hotel (lunes cada 2 semanas), Altozano (martes cada 2 semanas)

-- Calcular el próximo lunes (10 de febrero 2026)
-- Mayagoitia: cada 1 semana los lunes
UPDATE scheduled_services 
SET 
  next_run = '2026-02-10T00:01:00+00:00',
  next_service_date = '2026-02-10'
WHERE id = '1431b41c-fcaa-488f-ab76-3a428e4b8a4c';

-- Hotel: cada 2 semanas los lunes  
UPDATE scheduled_services 
SET 
  next_run = '2026-02-10T00:01:00+00:00',
  next_service_date = '2026-02-10'
WHERE id = '5a110398-74cf-4f90-9fe5-294fb0040b0b';

-- Altozano: cada 2 semanas los martes (próximo martes es 11 de febrero)
UPDATE scheduled_services 
SET 
  next_run = '2026-02-11T00:01:00+00:00',
  next_service_date = '2026-02-11'
WHERE id = '302b1d3f-c03c-4cdc-90c3-fed28243cb7c';
