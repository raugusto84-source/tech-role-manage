-- Crear tabla para vincular flotillas con categorías de servicios
CREATE TABLE public.fleet_service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fleet_group_id UUID NOT NULL REFERENCES public.fleet_groups(id) ON DELETE CASCADE,
  service_category_id UUID REFERENCES public.main_service_categories(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Un servicio específico o una categoría, no ambos
  CONSTRAINT check_service_or_category CHECK (
    (service_category_id IS NOT NULL AND service_type_id IS NULL) OR
    (service_category_id IS NULL AND service_type_id IS NOT NULL)
  )
);

-- Habilitar RLS
ALTER TABLE public.fleet_service_categories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Staff can manage fleet service categories" 
ON public.fleet_service_categories 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

CREATE POLICY "Everyone can view active fleet service categories" 
ON public.fleet_service_categories 
FOR SELECT 
USING (is_active = true);

-- Índices para mejor rendimiento
CREATE INDEX idx_fleet_service_categories_fleet_group ON public.fleet_service_categories(fleet_group_id);
CREATE INDEX idx_fleet_service_categories_service_category ON public.fleet_service_categories(service_category_id);
CREATE INDEX idx_fleet_service_categories_service_type ON public.fleet_service_categories(service_type_id);

-- Función para sugerir flotillas óptimas basándose en servicios
CREATE OR REPLACE FUNCTION public.suggest_optimal_fleet(
  p_service_type_id UUID,
  p_delivery_date DATE DEFAULT NULL
) RETURNS TABLE(
  fleet_group_id UUID,
  fleet_name TEXT,
  available_technicians INTEGER,
  average_skill_level NUMERIC,
  total_workload INTEGER,
  score NUMERIC,
  suggestion_reason TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rec RECORD;
  skill_weight NUMERIC := 0.6;  -- 60% peso a habilidades
  workload_weight NUMERIC := 0.2;  -- 20% peso a carga de trabajo
  availability_weight NUMERIC := 0.2;  -- 20% peso a disponibilidad
BEGIN
  -- Obtener flotillas que pueden manejar este tipo de servicio
  FOR rec IN 
    SELECT DISTINCT
      fg.id as fleet_id,
      fg.name as fleet_name,
      -- Contar técnicos disponibles en la flotilla
      (SELECT COUNT(DISTINCT fa.technician_id) 
       FROM public.fleet_assignments fa
       JOIN public.profiles p ON p.user_id = fa.technician_id
       WHERE fa.fleet_group_id = fg.id 
       AND fa.is_active = true 
       AND p.role = 'tecnico') as tech_count,
      -- Calcular habilidad promedio de técnicos en la flotilla para este servicio
      (SELECT AVG(COALESCE(ts.skill_level, 1))
       FROM public.fleet_assignments fa
       JOIN public.profiles p ON p.user_id = fa.technician_id
       LEFT JOIN public.technician_skills ts ON ts.technician_id = fa.technician_id 
         AND ts.service_type_id = p_service_type_id
       WHERE fa.fleet_group_id = fg.id 
       AND fa.is_active = true 
       AND p.role = 'tecnico') as avg_skill,
      -- Calcular carga de trabajo total de la flotilla
      (SELECT COUNT(*)
       FROM public.fleet_assignments fa
       JOIN public.orders o ON o.assigned_technician = fa.technician_id
       WHERE fa.fleet_group_id = fg.id 
       AND fa.is_active = true 
       AND o.status IN ('pendiente', 'en_proceso', 'en_camino')) as total_load
    FROM public.fleet_groups fg
    JOIN public.fleet_service_categories fsc ON fsc.fleet_group_id = fg.id
    WHERE fg.is_active = true
    AND fsc.is_active = true
    AND (
      fsc.service_type_id = p_service_type_id OR
      fsc.service_category_id = (
        SELECT st.main_category_id 
        FROM public.service_types st 
        WHERE st.id = p_service_type_id
      )
    )
  LOOP
    DECLARE
      skill_score NUMERIC := 0;
      workload_score NUMERIC := 0;
      availability_score NUMERIC := 0;
      total_score NUMERIC := 0;
      reason_text TEXT := '';
    BEGIN
      -- Calcular puntuación de habilidades (1-10)
      skill_score := CASE
        WHEN rec.avg_skill >= 4.5 THEN 10
        WHEN rec.avg_skill >= 3.5 THEN 8
        WHEN rec.avg_skill >= 2.5 THEN 6
        WHEN rec.avg_skill >= 1.5 THEN 4
        ELSE 2
      END;
      
      -- Calcular puntuación de carga de trabajo (inversa)
      workload_score := CASE
        WHEN rec.total_load = 0 THEN 10
        WHEN rec.total_load <= 5 THEN 8
        WHEN rec.total_load <= 10 THEN 6
        WHEN rec.total_load <= 15 THEN 4
        ELSE 2
      END;
      
      -- Calcular puntuación de disponibilidad
      availability_score := CASE
        WHEN rec.tech_count >= 5 THEN 10
        WHEN rec.tech_count >= 3 THEN 8
        WHEN rec.tech_count >= 2 THEN 6
        WHEN rec.tech_count >= 1 THEN 4
        ELSE 0
      END;
      
      -- Calcular puntuación total ponderada
      total_score := (skill_score * skill_weight) + 
                     (workload_score * workload_weight) + 
                     (availability_score * availability_weight);
      
      -- Generar razón de sugerencia
      reason_text := 'Flotilla especializada con ';
      
      IF rec.avg_skill >= 4 THEN
        reason_text := reason_text || 'alto nivel de expertise (' || ROUND(rec.avg_skill, 1) || '/5)';
      ELSIF rec.avg_skill >= 3 THEN
        reason_text := reason_text || 'buen nivel de habilidades (' || ROUND(rec.avg_skill, 1) || '/5)';
      ELSE
        reason_text := reason_text || 'nivel básico de habilidades (' || ROUND(rec.avg_skill, 1) || '/5)';
      END IF;
      
      reason_text := reason_text || ', ' || rec.tech_count || ' técnicos disponibles';
      
      IF rec.total_load = 0 THEN
        reason_text := reason_text || ' y sin carga de trabajo actual';
      ELSIF rec.total_load <= 5 THEN
        reason_text := reason_text || ' y baja carga de trabajo (' || rec.total_load || ' órdenes)';
      ELSIF rec.total_load <= 10 THEN
        reason_text := reason_text || ' y carga moderada (' || rec.total_load || ' órdenes)';
      ELSE
        reason_text := reason_text || ' pero alta carga (' || rec.total_load || ' órdenes)';
      END IF;
      
      -- Retornar datos de la flotilla
      fleet_group_id := rec.fleet_id;
      fleet_name := rec.fleet_name;
      available_technicians := rec.tech_count;
      average_skill_level := ROUND(rec.avg_skill, 2);
      total_workload := rec.total_load;
      score := total_score;
      suggestion_reason := reason_text;
      
      RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;