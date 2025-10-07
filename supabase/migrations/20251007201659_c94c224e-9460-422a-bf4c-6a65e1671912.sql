-- Step 1: Fix existing NULL changed_by entries
-- Update NULL entries with created_by from the order
UPDATE public.order_status_logs osl
SET changed_by = o.created_by
FROM public.orders o
WHERE osl.order_id = o.id
  AND osl.changed_by IS NULL
  AND o.created_by IS NOT NULL;

-- For remaining NULL entries, use first admin user
UPDATE public.order_status_logs osl
SET changed_by = (
  SELECT user_id 
  FROM public.profiles 
  WHERE role = 'administrador' 
  LIMIT 1
)
WHERE osl.changed_by IS NULL;

-- Step 2: Fix handle_order_status_changes trigger to NEVER allow NULL
CREATE OR REPLACE FUNCTION public.handle_order_status_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_to_log UUID;
  fallback_admin_id UUID;
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Get fallback admin user
    SELECT user_id INTO fallback_admin_id
    FROM public.profiles
    WHERE role = 'administrador'
    LIMIT 1;
    
    -- Determine who changed it: NEVER allow NULL!
    user_to_log := COALESCE(
      auth.uid(), 
      NEW.completed_by, 
      NEW.created_by,
      fallback_admin_id,
      '00000000-0000-0000-0000-000000000000'::UUID  -- Ultimate fallback
    );
    
    -- Log status change
    INSERT INTO public.order_status_logs (
      order_id, previous_status, new_status, changed_by,
      notes
    ) VALUES (
      NEW.id, OLD.status, NEW.status, user_to_log,
      CASE 
        WHEN NEW.status = 'en_camino' THEN 'Técnico en camino al sitio'
        WHEN NEW.status = 'en_proceso' THEN 'Técnico iniciando trabajo'
        WHEN NEW.status = 'finalizada' THEN 'Trabajo completado'
        ELSE NULL
      END
    );
    
    -- Update technician workload
    IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
      UPDATE public.technician_workload 
      SET status = 'completed', updated_at = now()
      WHERE order_id = NEW.id;
      
      -- Calculate warranty dates for finalized orders
      UPDATE public.order_items 
      SET 
        warranty_start_date = CURRENT_DATE,
        warranty_end_date = CURRENT_DATE + INTERVAL '1 day' * COALESCE(
          (SELECT st.warranty_duration_days 
           FROM public.service_types st 
           WHERE st.id = order_items.service_type_id), 
          0
        ),
        warranty_conditions = COALESCE(
          (SELECT st.warranty_conditions 
           FROM public.service_types st 
           WHERE st.id = order_items.service_type_id),
          'Sin garantía específica'
        )
      WHERE order_id = NEW.id AND warranty_start_date IS NULL;
      
    ELSIF NEW.status = 'cancelada' AND OLD.status != 'cancelada' THEN
      UPDATE public.technician_workload 
      SET status = 'cancelled', updated_at = now()
      WHERE order_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Step 3: Now backfill orders with delivery signatures
UPDATE public.orders o
SET status = 'finalizada'::order_status,
    updated_at = now()
FROM public.delivery_signatures ds
WHERE ds.order_id = o.id
  AND o.status = 'pendiente_entrega'::order_status;