-- Rework suggest_optimal_fleet to assign fleets by main category only (sistemas/seguridad)
CREATE OR REPLACE FUNCTION public.suggest_optimal_fleet(
  p_service_type_id uuid,
  p_delivery_date date DEFAULT NULL::date
)
RETURNS TABLE(
  fleet_group_id uuid,
  fleet_name text,
  available_technicians integer,
  average_skill_level numeric,
  total_workload integer,
  score numeric,
  suggestion_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  rec RECORD;
  service_category TEXT;
  skill_weight NUMERIC := 0.6;  -- 60% peso a habilidades
  workload_weight NUMERIC := 0.2;  -- 20% peso a carga de trabajo
  availability_weight NUMERIC := 0.2;  -- 20% peso a disponibilidad
BEGIN
  -- Derivar la categoría principal del servicio (sistemas/seguridad)
  SELECT st.service_category INTO service_category
  FROM public.service_types st 
  WHERE st.id = p_service_type_id;
  
  IF service_category IS NULL THEN
    service_category := 'sistemas';
  END IF;

  -- Seleccionar flotillas SOLO por categoría principal; no requiere vínculos por servicio
  FOR rec IN 
    SELECT 
      fg.id as fleet_id,
      fg.name as fleet_name,
      -- Técnicos disponibles en la flotilla
      (SELECT COUNT(DISTINCT fa.technician_id)
       FROM public.fleet_assignments fa
       JOIN public.profiles p ON p.user_id = fa.technician_id
       WHERE fa.fleet_group_id = fg.id 
         AND fa.is_active = true 
         AND p.role = 'tecnico') as tech_count,
      -- Habilidad promedio PARA ESTE SERVICIO si existe; si no, promedio general=1
      (SELECT COALESCE(AVG(NULLIF(ts.skill_level, 0)), 1)
       FROM public.fleet_assignments fa
       JOIN public.profiles p ON p.user_id = fa.technician_id
       LEFT JOIN public.technician_skills ts 
         ON ts.technician_id = fa.technician_id 
        AND ts.service_type_id = p_service_type_id
       WHERE fa.fleet_group_id = fg.id 
         AND fa.is_active = true 
         AND p.role = 'tecnico') as avg_skill,
      -- Carga de trabajo total de la flotilla (órdenes activas de sus técnicos)
      (SELECT COUNT(*)
       FROM public.fleet_assignments fa
       JOIN public.orders o ON o.assigned_technician = fa.technician_id
       WHERE fa.fleet_group_id = fg.id 
         AND fa.is_active = true 
         AND o.status IN ('pendiente', 'en_proceso', 'en_camino')) as total_load
    FROM public.fleet_groups fg
    WHERE fg.is_active = true
      AND fg.category = service_category
  LOOP
    DECLARE
      skill_score NUMERIC := 0;
      workload_score NUMERIC := 0;
      availability_score NUMERIC := 0;
      total_score NUMERIC := 0;
      reason_text TEXT := '';
    BEGIN
      -- Calcular puntuaciones
      skill_score := CASE
        WHEN rec.avg_skill >= 4.5 THEN 10
        WHEN rec.avg_skill >= 3.5 THEN 8
        WHEN rec.avg_skill >= 2.5 THEN 6
        WHEN rec.avg_skill >= 1.5 THEN 4
        ELSE 2
      END;
      
      workload_score := CASE
        WHEN rec.total_load = 0 THEN 10
        WHEN rec.total_load <= 5 THEN 8
        WHEN rec.total_load <= 10 THEN 6
        WHEN rec.total_load <= 15 THEN 4
        ELSE 2
      END;
      
      availability_score := CASE
        WHEN rec.tech_count >= 5 THEN 10
        WHEN rec.tech_count >= 3 THEN 8
        WHEN rec.tech_count >= 2 THEN 6
        WHEN rec.tech_count >= 1 THEN 4
        ELSE 0
      END;
      
      total_score := (skill_score * skill_weight) + 
                     (workload_score * workload_weight) + 
                     (availability_score * availability_weight);
      
      reason_text := 'Flotilla de ' || UPPER(service_category) ||
                     ' • técnicos: ' || rec.tech_count ||
                     ' • habilidad prom: ' || COALESCE(ROUND(rec.avg_skill, 1)::text, '1.0') ||
                     ' • carga: ' || rec.total_load;

      -- Emitir fila
      fleet_group_id := rec.fleet_id;
      fleet_name := rec.fleet_name;
      available_technicians := rec.tech_count;
      average_skill_level := COALESCE(ROUND(rec.avg_skill, 2), 1);
      total_workload := rec.total_load;
      score := total_score;
      suggestion_reason := reason_text;
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$function$;