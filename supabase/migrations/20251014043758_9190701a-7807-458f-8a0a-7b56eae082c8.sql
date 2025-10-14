-- Fix trigger that overwrites status to 'pendiente' when approving
CREATE OR REPLACE FUNCTION public.approve_order_by_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    
    -- CRITICAL FIX: Solo establecer estado a 'pendiente' si NO se está estableciendo explícitamente otro estado
    -- Esto permite que los administradores aprueben directamente a 'en_proceso'
    IF NEW.status = OLD.status OR NEW.status IS NULL THEN
      NEW.status := 'pendiente'::order_status;
    END IF;
    
    NEW.client_approved_at := now();
    NEW.estimated_delivery_date := estimated_delivery;

    -- Registrar el cambio por aprobación solo si el estado cambió a pendiente
    IF NEW.status = 'pendiente'::order_status THEN
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
        COALESCE(auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
        'Orden aprobada por el cliente, esperando asignación de técnico'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;