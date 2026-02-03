-- Corregir órdenes de Mayagoitia y Hotel: Feb 9 -> Feb 2 (lunes de ESTA semana)
UPDATE orders 
SET delivery_date = '2026-02-02',
    failure_description = REPLACE(failure_description, '2026-02-09', '2026-02-02')
WHERE id IN ('1b304f5f-7bd4-45e4-bf51-2007e4b8ba17', 'e112075a-e4d3-4b32-a017-de61d8580ca6');

-- Corregir orden de Altozano: Feb 10 -> Feb 3 (martes de ESTA semana)
UPDATE orders 
SET delivery_date = '2026-02-03',
    failure_description = REPLACE(failure_description, '2026-02-10', '2026-02-03')
WHERE id = 'fd61908a-c92c-4f8e-a02f-4d94989639b2';

-- Restablecer next_run correctamente para la PRÓXIMA semana
-- Mayagoitia: próximo lunes 9 feb
UPDATE scheduled_services SET next_run = '2026-02-09 00:01:00+00', next_service_date = '2026-02-09'
WHERE id = '1431b41c-fcaa-488f-ab76-3a428e4b8a4c';

-- Hotel: próximo lunes 9 feb  
UPDATE scheduled_services SET next_run = '2026-02-09 00:01:00+00', next_service_date = '2026-02-09'
WHERE id = '5a110398-74cf-4f90-9fe5-294fb0040b0b';

-- Altozano: próximo martes 10 feb
UPDATE scheduled_services SET next_run = '2026-02-10 00:01:00+00', next_service_date = '2026-02-10'
WHERE id = '302b1d3f-c03c-4cdc-90c3-fed28243cb7c';