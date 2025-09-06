-- Update existing service_types records to set service_category based on their category and name
UPDATE public.service_types 
SET service_category = CASE
  -- Seguridad: Cámaras, Alarmas, Fraccionamientos (operadores), Cercas, Control de Acceso
  WHEN category IN ('Cámaras de Seguridad', 'Alarmas', 'Fraccionamientos', 'Cercas Eléctricas', 'Control de Acceso') 
    OR name ILIKE '%camara%' 
    OR name ILIKE '%cámara%' 
    OR name ILIKE '%alarma%' 
    OR name ILIKE '%operador%' 
    OR name ILIKE '%seguridad%' 
    OR name ILIKE '%cerca%' 
    OR name ILIKE '%control de acceso%' 
    OR name ILIKE '%dvr%'
    OR name ILIKE '%detector%'
    THEN 'seguridad'
  
  -- Sistemas: Computadoras y servicios técnicos de sistemas
  WHEN category IN ('Computadoras') 
    OR name ILIKE '%formateo%' 
    OR name ILIKE '%sistema%' 
    OR name ILIKE '%software%' 
    OR name ILIKE '%instalacion%' 
    OR name ILIKE '%mantenimiento%'
    OR name ILIKE '%computadora%'
    OR name ILIKE '%pc%'
    OR name ILIKE '%reparacion%'
    THEN 'sistemas'
  
  -- Por defecto sistemas para casos no clasificados
  ELSE 'sistemas'
END
WHERE service_category IS NULL OR service_category = 'sistemas';