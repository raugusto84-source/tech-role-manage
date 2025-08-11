-- Función para actualizar automáticamente los niveles de habilidad basado en órdenes completadas
CREATE OR REPLACE FUNCTION public.update_technician_skill_levels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_record RECORD;
  completed_orders_count INTEGER;
  new_skill_level INTEGER;
BEGIN
  -- Solo actualizar cuando una orden se finaliza
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' AND NEW.assigned_technician IS NOT NULL THEN
    
    -- Obtener todos los servicios de esta orden
    FOR service_record IN 
      SELECT DISTINCT oi.service_type_id 
      FROM order_items oi 
      WHERE oi.order_id = NEW.id
    LOOP
      -- Contar cuántas órdenes ha completado el técnico para este tipo de servicio
      SELECT COUNT(*) INTO completed_orders_count
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.assigned_technician = NEW.assigned_technician
        AND o.status = 'finalizada'
        AND oi.service_type_id = service_record.service_type_id;
      
      -- Calcular nuevo nivel de habilidad basado en experiencia
      -- 1-2 órdenes = nivel 1
      -- 3-5 órdenes = nivel 2  
      -- 6-10 órdenes = nivel 3
      -- 11-20 órdenes = nivel 4
      -- 21+ órdenes = nivel 5
      IF completed_orders_count >= 21 THEN
        new_skill_level := 5;
      ELSIF completed_orders_count >= 11 THEN
        new_skill_level := 4;
      ELSIF completed_orders_count >= 6 THEN
        new_skill_level := 3;
      ELSIF completed_orders_count >= 3 THEN
        new_skill_level := 2;
      ELSE
        new_skill_level := 1;
      END IF;
      
      -- Actualizar o insertar la habilidad del técnico
      INSERT INTO technician_skills (
        technician_id, 
        service_type_id, 
        skill_level, 
        years_experience,
        notes
      ) VALUES (
        NEW.assigned_technician,
        service_record.service_type_id,
        new_skill_level,
        0,
        'Actualizado automáticamente basado en ' || completed_orders_count || ' órdenes completadas'
      )
      ON CONFLICT (technician_id, service_type_id) 
      DO UPDATE SET 
        skill_level = new_skill_level,
        notes = 'Actualizado automáticamente basado en ' || completed_orders_count || ' órdenes completadas',
        updated_at = now();
        
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger para actualizar habilidades automáticamente
DROP TRIGGER IF EXISTS update_skills_on_order_completion ON public.orders;
CREATE TRIGGER update_skills_on_order_completion
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_technician_skill_levels();