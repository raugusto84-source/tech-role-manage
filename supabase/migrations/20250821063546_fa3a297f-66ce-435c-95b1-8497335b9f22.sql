-- Update approve_order_by_client to auto-assign technician on client approval
CREATE OR REPLACE FUNCTION public.approve_order_by_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  estimated_delivery TIMESTAMP WITH TIME ZONE;
  primary_service_type uuid;
  tech_suggestion RECORD;
  recomputed_estimate TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Solo procesar cuando el cliente aprueba la orden
  IF NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM NEW.client_approval THEN
    
    -- Calcular fecha estimada de entrega inicial
    estimated_delivery := public.calculate_estimated_delivery_time(NEW.id);
    NEW.status := 'pendiente'::order_status;
    NEW.client_approved_at := now();
    NEW.estimated_delivery_date := estimated_delivery;

    -- Registrar el cambio por aprobación
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      'pendiente'::order_status,
      auth.uid(),
      COALESCE(NEW.client_approval_notes, 'Orden aprobada por el cliente') || 
      '. Fecha estimada de entrega: ' || to_char(estimated_delivery, 'DD/MM/YYYY HH24:MI')
    );

    -- Determinar servicio principal por peso (horas estimadas * cantidad)
    SELECT oi.service_type_id
    INTO primary_service_type
    FROM order_items oi
    LEFT JOIN service_types st ON st.id = oi.service_type_id
    WHERE oi.order_id = NEW.id
    GROUP BY oi.service_type_id
    ORDER BY SUM(COALESCE(st.estimated_hours, 4) * oi.quantity) DESC
    LIMIT 1;

    -- Si no hay técnico asignado, intentar asignación automática basada en el servicio principal
    IF NEW.assigned_technician IS NULL AND primary_service_type IS NOT NULL THEN
      SELECT s.technician_id, s.full_name, s.score, s.suggestion_reason
      INTO tech_suggestion
      FROM public.suggest_optimal_technician(primary_service_type, NULL::date) AS s
      ORDER BY s.score DESC NULLS LAST
      LIMIT 1;

      IF tech_suggestion.technician_id IS NOT NULL THEN
        NEW.assigned_technician := tech_suggestion.technician_id;

        -- Recalcular la fecha estimada considerando asignación
        recomputed_estimate := public.calculate_estimated_delivery_time(NEW.id);
        NEW.estimated_delivery_date := recomputed_estimate;

        -- Log de asignación automática
        INSERT INTO public.order_status_logs (
          order_id,
          previous_status,
          new_status,
          changed_by,
          notes
        ) VALUES (
          NEW.id,
          'pendiente'::order_status,
          'pendiente'::order_status,
          auth.uid(),
          'Técnico asignado automáticamente: ' || tech_suggestion.full_name ||
          ' (' || COALESCE(tech_suggestion.suggestion_reason, 'criterios automáticos') || ')' ||
          '. Nueva entrega estimada: ' || to_char(recomputed_estimate, 'DD/MM/YYYY HH24:MI')
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;