-- Update the suggest_optimal_technician function to prioritize skill and exclude technicians without the required skill

CREATE OR REPLACE FUNCTION public.suggest_optimal_technician(p_service_type_id uuid, p_delivery_date date DEFAULT NULL::date)
 RETURNS TABLE(technician_id uuid, full_name text, current_workload integer, skill_level integer, years_experience integer, score numeric, suggestion_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  workload_weight NUMERIC := 0.2;  -- Reduced workload weight to 20%
  skill_weight NUMERIC := 0.8;     -- Increased skill weight to 80%
  max_score NUMERIC := 0;
  best_technician RECORD;
BEGIN
  -- Calculate metrics for each technician, BUT ONLY for those who have the required skill
  FOR rec IN 
    SELECT 
      p.user_id,
      p.full_name,
      ts.skill_level,
      COALESCE(ts.years_experience, 0) as years_experience,
      -- Count active orders (pending + in_process + on_way)
      (SELECT COUNT(*) 
       FROM orders o 
       WHERE o.assigned_technician = p.user_id 
       AND o.status IN ('pendiente', 'en_proceso', 'en_camino')) as current_workload
    FROM profiles p
    INNER JOIN technician_skills ts ON ts.technician_id = p.user_id 
      AND ts.service_type_id = p_service_type_id
    WHERE p.role = 'tecnico'
      AND ts.skill_level IS NOT NULL  -- Ensure they have a skill level for this service
      AND ts.skill_level > 0          -- Only technicians with actual skill (level > 0)
  LOOP
    -- Calculate score based on:
    -- - Higher skill level (80%)
    -- - Lower workload (20%)
    DECLARE
      workload_score NUMERIC;
      skill_score NUMERIC;
      total_score NUMERIC;
      reason_text TEXT;
    BEGIN
      -- Workload score (inverse: less workload = better score)
      workload_score := CASE 
        WHEN rec.current_workload = 0 THEN 10
        WHEN rec.current_workload <= 2 THEN 8
        WHEN rec.current_workload <= 4 THEN 6
        WHEN rec.current_workload <= 6 THEN 4
        ELSE 2
      END;
      
      -- Skill score (1-5 scale to 1-10, with higher emphasis on high skills)
      skill_score := CASE
        WHEN rec.skill_level = 5 THEN 10
        WHEN rec.skill_level = 4 THEN 8
        WHEN rec.skill_level = 3 THEN 6
        WHEN rec.skill_level = 2 THEN 4
        WHEN rec.skill_level = 1 THEN 2
        ELSE 0
      END;
      
      -- Total weighted score (skill is now 80% of the decision)
      total_score := (workload_score * workload_weight) + (skill_score * skill_weight);
      
      -- Generate suggestion reason with skill emphasis
      reason_text := CASE
        WHEN rec.skill_level = 5 THEN
          'Experto en este servicio (nivel 5/5)'
        WHEN rec.skill_level = 4 THEN
          'Muy hábil en este servicio (nivel 4/5)'
        WHEN rec.skill_level = 3 THEN
          'Competente en este servicio (nivel 3/5)'
        WHEN rec.skill_level = 2 THEN
          'Habilidad básica en este servicio (nivel 2/5)'
        ELSE
          'Habilidad inicial en este servicio (nivel 1/5)'
      END;
      
      -- Add workload info to reason
      IF rec.current_workload = 0 THEN
        reason_text := reason_text || ' y completamente disponible';
      ELSIF rec.current_workload <= 2 THEN
        reason_text := reason_text || ' con baja carga de trabajo (' || rec.current_workload || ' órdenes)';
      ELSIF rec.current_workload <= 4 THEN
        reason_text := reason_text || ' con carga moderada (' || rec.current_workload || ' órdenes)';
      ELSE
        reason_text := reason_text || ' con alta carga (' || rec.current_workload || ' órdenes)';
      END IF;
      
      -- Add experience if available
      IF rec.years_experience > 0 THEN
        reason_text := reason_text || ', ' || rec.years_experience || ' años de experiencia';
      END IF;
      
      -- Return technician data
      technician_id := rec.user_id;
      full_name := rec.full_name;
      current_workload := rec.current_workload;
      skill_level := rec.skill_level;
      years_experience := rec.years_experience;
      score := total_score;
      suggestion_reason := reason_text;
      
      RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$function$;