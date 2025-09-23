-- =============================================================================
-- DATABASE OPTIMIZATION - SIMPLIFIED VERSION
-- Optimized triggers and essential indexes only
-- =============================================================================

-- =============================================================================
-- SECTION 1: OPTIMIZED TRIGGERS
-- =============================================================================

-- Drop existing triggers that need optimization
DROP TRIGGER IF EXISTS update_technician_workload ON orders;
DROP TRIGGER IF EXISTS calculate_warranty_dates ON orders;
DROP TRIGGER IF EXISTS log_order_status_change ON orders;

-- Optimized single trigger for order status changes (replaces 3 separate triggers)
CREATE OR REPLACE FUNCTION public.handle_order_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Log status change
    INSERT INTO public.order_status_logs (
      order_id, previous_status, new_status, changed_by,
      notes
    ) VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid(),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create optimized trigger
CREATE TRIGGER handle_order_status_changes_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_status_changes();

-- =============================================================================
-- SECTION 2: ESSENTIAL PERFORMANCE INDEXES
-- =============================================================================

-- Critical indexes for automation queries
CREATE INDEX IF NOT EXISTS idx_policies_status 
  ON public.policies(status) 
  WHERE status = 'activa';

CREATE INDEX IF NOT EXISTS idx_policy_payments_client_date 
  ON public.policy_payments(policy_client_id, payment_date);

CREATE INDEX IF NOT EXISTS idx_scheduled_services_active 
  ON public.scheduled_services(policy_client_id, next_service_date) 
  WHERE is_active = true;

-- Financial query indexes
CREATE INDEX IF NOT EXISTS idx_incomes_date 
  ON public.incomes(income_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_date 
  ON public.expenses(expense_date DESC);

-- Order performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_status_technician 
  ON public.orders(status, assigned_technician);

CREATE INDEX IF NOT EXISTS idx_order_items_order 
  ON public.order_items(order_id);

-- =============================================================================
-- SECTION 3: OPTIMIZATION FUNCTIONS
-- =============================================================================

-- Function to get automation metrics
CREATE OR REPLACE FUNCTION public.get_automation_metrics(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  active_policies INTEGER,
  overdue_payments INTEGER,
  pending_services INTEGER,
  completed_orders INTEGER,
  total_revenue NUMERIC,
  avg_satisfaction NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM public.policies WHERE status = 'activa'),
    (SELECT COUNT(*)::INTEGER FROM public.policy_payments 
     WHERE payment_date < CURRENT_DATE - INTERVAL '30 days' 
     AND payment_status != 'paid'),
    (SELECT COUNT(*)::INTEGER FROM public.scheduled_services 
     WHERE next_service_date <= CURRENT_DATE AND is_active = true),
    (SELECT COUNT(*)::INTEGER FROM public.orders 
     WHERE status = 'finalizada' 
     AND created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back),
    (SELECT COALESCE(SUM(amount), 0) FROM public.incomes 
     WHERE income_date >= CURRENT_DATE - INTERVAL '1 day' * days_back),
    (SELECT COALESCE(AVG(overall_recommendation), 0) 
     FROM public.technician_satisfaction_surveys tss
     JOIN public.orders o ON o.id = tss.order_id
     WHERE o.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;