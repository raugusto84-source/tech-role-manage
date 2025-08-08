-- ===============================================
-- SISTEMA DE HABILIDADES TÉCNICAS Y SUGERENCIAS
-- ===============================================

-- Crear tabla de habilidades técnicas
CREATE TABLE public.technician_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  skill_level INTEGER NOT NULL DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 5),
  years_experience INTEGER DEFAULT 0,
  certifications TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(technician_id, service_type_id)
);

-- Habilitar RLS en technician_skills
ALTER TABLE public.technician_skills ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para technician_skills
CREATE POLICY "Admins can manage all technician skills" 
ON public.technician_skills 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view technician skills" 
ON public.technician_skills 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'vendedor', 'tecnico']));

CREATE POLICY "Technicians can view and update their own skills" 
ON public.technician_skills 
FOR ALL 
USING (technician_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_technician_skills_updated_at
BEFORE UPDATE ON public.technician_skills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===============================================
-- FUNCIÓN PARA SUGERIR TÉCNICO ÓPTIMO
-- ===============================================

CREATE OR REPLACE FUNCTION public.suggest_optimal_technician(
  p_service_type_id UUID,
  p_delivery_date DATE DEFAULT NULL
)
RETURNS TABLE(
  technician_id UUID,
  full_name TEXT,
  current_workload INTEGER,
  skill_level INTEGER,
  years_experience INTEGER,
  score NUMERIC,
  suggestion_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rec RECORD;
  workload_weight NUMERIC := 0.4;
  skill_weight NUMERIC := 0.6;
  max_score NUMERIC := 0;
  best_technician RECORD;
BEGIN
  -- Calcular métricas para cada técnico
  FOR rec IN 
    SELECT 
      p.user_id,
      p.full_name,
      COALESCE(ts.skill_level, 1) as skill_level,
      COALESCE(ts.years_experience, 0) as years_experience,
      -- Contar órdenes activas (pendiente + en_proceso)
      (SELECT COUNT(*) 
       FROM orders o 
       WHERE o.assigned_technician = p.user_id 
       AND o.status IN ('pendiente', 'en_proceso', 'en_camino')) as current_workload
    FROM profiles p
    LEFT JOIN technician_skills ts ON ts.technician_id = p.user_id 
      AND ts.service_type_id = p_service_type_id
    WHERE p.role = 'tecnico'
  LOOP
    -- Calcular puntuación basada en:
    -- - Menos carga de trabajo (40%)
    -- - Mayor habilidad (60%)
    DECLARE
      workload_score NUMERIC;
      skill_score NUMERIC;
      total_score NUMERIC;
      reason_text TEXT;
    BEGIN
      -- Puntuación por carga de trabajo (inversa: menos carga = mejor puntuación)
      workload_score := CASE 
        WHEN rec.current_workload = 0 THEN 10
        WHEN rec.current_workload <= 2 THEN 8
        WHEN rec.current_workload <= 4 THEN 6
        WHEN rec.current_workload <= 6 THEN 4
        ELSE 2
      END;
      
      -- Puntuación por habilidad (1-5 escala a 1-10)
      skill_score := rec.skill_level * 2;
      
      -- Puntuación total ponderada
      total_score := (workload_score * workload_weight) + (skill_score * skill_weight);
      
      -- Generar razón de la sugerencia
      reason_text := CASE
        WHEN rec.skill_level >= 4 AND rec.current_workload <= 2 THEN
          'Alto nivel de habilidad (' || rec.skill_level || '/5) con baja carga de trabajo (' || rec.current_workload || ' órdenes)'
        WHEN rec.skill_level >= 4 THEN
          'Alto nivel de habilidad (' || rec.skill_level || '/5)'
        WHEN rec.current_workload = 0 THEN
          'Completamente disponible (sin órdenes activas)'
        WHEN rec.current_workload <= 2 THEN
          'Baja carga de trabajo (' || rec.current_workload || ' órdenes activas)'
        ELSE
          'Nivel de habilidad ' || rec.skill_level || '/5, ' || rec.current_workload || ' órdenes activas'
      END;
      
      -- Agregar experiencia si está disponible
      IF rec.years_experience > 0 THEN
        reason_text := reason_text || ', ' || rec.years_experience || ' años de experiencia';
      END IF;
      
      -- Retornar los datos del técnico
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
$$;

-- ===============================================
-- DATOS INICIALES DE HABILIDADES
-- ===============================================

-- Insertar habilidades básicas para el técnico existente
INSERT INTO public.technician_skills (technician_id, service_type_id, skill_level, years_experience, notes)
SELECT 
  p.user_id,
  st.id,
  -- Asignar niveles de habilidad variados para demostración
  CASE 
    WHEN st.name = 'Formateo' THEN 5
    WHEN st.name = 'Reparación de Hardware' THEN 4
    WHEN st.name = 'Instalación de Software' THEN 5
    WHEN st.name = 'Mantenimiento' THEN 4
    WHEN st.name = 'Instalación de Antivirus' THEN 5
    ELSE 3
  END,
  CASE 
    WHEN st.name IN ('Formateo', 'Instalación de Software') THEN 3
    WHEN st.name = 'Reparación de Hardware' THEN 2
    ELSE 1
  END,
  'Habilidad inicial asignada por el sistema'
FROM profiles p
CROSS JOIN service_types st
WHERE p.role = 'tecnico' 
AND st.is_active = true
ON CONFLICT (technician_id, service_type_id) DO NOTHING;