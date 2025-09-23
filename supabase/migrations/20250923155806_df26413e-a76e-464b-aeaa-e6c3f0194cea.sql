-- =============================================================================
-- DATABASE OPTIMIZATION FOR AUTOMATION SYSTEM (FINAL VERSION - CORRECTED COLUMNS)
-- Optimized triggers, cross-module views, and performance indexes
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
-- SECTION 2: CROSS-MODULE REPORTING VIEWS
-- =============================================================================

-- Unified Financial Overview View
CREATE OR REPLACE VIEW public.financial_overview AS
SELECT 
  'income' as transaction_type,
  i.id,
  i.amount,
  i.income_date as transaction_date,
  i.description,
  i.account_type,
  i.payment_method,
  i.created_by,
  p.full_name as created_by_name,
  NULL::uuid as order_id,
  NULL::uuid as policy_id
FROM public.incomes i
LEFT JOIN public.profiles p ON p.user_id = i.created_by

UNION ALL

SELECT 
  'expense' as transaction_type,
  e.id,
  -e.amount as amount,
  e.expense_date as transaction_date,
  e.description,
  e.account_type,
  e.payment_method,
  e.created_by,
  p.full_name as created_by_name,
  NULL::uuid as order_id,
  NULL::uuid as policy_id
FROM public.expenses e
LEFT JOIN public.profiles p ON p.user_id = e.created_by

UNION ALL

SELECT 
  'policy_payment' as transaction_type,
  pp.id,
  pp.amount,
  pp.payment_date::timestamp with time zone as transaction_date,
  'Pago de póliza: ' || pol.policy_number as description,
  pp.account_type,
  pp.payment_method,
  pp.created_by,
  p.full_name as created_by_name,
  NULL::uuid as order_id,
  pp.policy_client_id as policy_id
FROM public.policy_payments pp
LEFT JOIN public.policies pol ON pol.id = pp.policy_client_id
LEFT JOIN public.profiles p ON p.user_id = pp.created_by;

-- Comprehensive Order Analytics View
CREATE OR REPLACE VIEW public.order_analytics AS
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.created_at,
  o.estimated_delivery_date,
  c.name as client_name,
  c.email as client_email,
  tp.full_name as technician_name,
  sp.full_name as salesperson_name,
  -- Financial metrics
  COALESCE(SUM(oi.total_amount), 0) as total_amount,
  COALESCE(SUM(oi.subtotal), 0) as subtotal,
  COALESCE(SUM(oi.vat_amount), 0) as vat_amount,
  -- Service metrics
  COUNT(oi.id) as total_items,
  COUNT(CASE WHEN oi.item_type = 'servicio' THEN 1 END) as service_items,
  COUNT(CASE WHEN oi.item_type = 'articulo' THEN 1 END) as product_items,
  -- Time metrics
  CASE WHEN o.status = 'finalizada' 
       THEN EXTRACT(EPOCH FROM (o.updated_at - o.created_at))/3600 
       ELSE 0 END as completion_hours,
  -- Satisfaction metrics
  COALESCE(AVG(tss.overall_recommendation), 0) as satisfaction_score
FROM public.orders o
LEFT JOIN public.clients c ON c.id = o.client_id
LEFT JOIN public.profiles tp ON tp.user_id = o.assigned_technician
LEFT JOIN public.profiles sp ON sp.user_id = o.created_by
LEFT JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.technician_satisfaction_surveys tss ON tss.order_id = o.id
GROUP BY o.id, o.order_number, o.status, o.created_at, o.estimated_delivery_date,
         c.name, c.email, tp.full_name, sp.full_name, o.updated_at;

-- Policy Performance Dashboard View
CREATE OR REPLACE VIEW public.policy_dashboard AS
SELECT 
  p.id,
  p.policy_number,
  p.client_name,
  p.client_email,
  p.status,
  p.monthly_cost,
  p.start_date,
  p.end_date,
  -- Payment metrics
  COALESCE(COUNT(pp.id), 0) as total_payments,
  COALESCE(SUM(pp.amount), 0) as total_paid,
  COALESCE(MAX(pp.payment_date), p.start_date) as last_payment_date,
  -- Service metrics
  COALESCE(COUNT(ss.id), 0) as scheduled_services,
  COALESCE(COUNT(CASE WHEN ss.is_active = true THEN 1 END), 0) as active_services,
  -- Revenue metrics
  p.monthly_cost * GREATEST(EXTRACT(MONTHS FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)), 1) as projected_revenue,
  -- Health score (0-100)
  CASE 
    WHEN p.status = 'cancelada' THEN 0
    WHEN COALESCE(MAX(pp.payment_date), p.start_date) < CURRENT_DATE - INTERVAL '45 days' THEN 25
    WHEN COALESCE(MAX(pp.payment_date), p.start_date) < CURRENT_DATE - INTERVAL '30 days' THEN 50
    WHEN COALESCE(COUNT(CASE WHEN ss.is_active = true THEN 1 END), 0) > 0 THEN 100
    ELSE 75
  END as health_score
FROM public.policies p
LEFT JOIN public.policy_payments pp ON pp.policy_client_id = p.id
LEFT JOIN public.scheduled_services ss ON ss.policy_client_id = p.id
GROUP BY p.id, p.policy_number, p.client_name, p.client_email, p.status, 
         p.monthly_cost, p.start_date, p.end_date;

-- Technician Performance View
CREATE OR REPLACE VIEW public.technician_performance AS
SELECT 
  p.user_id,
  p.full_name,
  p.role,
  -- Order metrics
  COUNT(o.id) as total_orders,
  COUNT(CASE WHEN o.status = 'finalizada' THEN 1 END) as completed_orders,
  COUNT(CASE WHEN o.status = 'cancelada' THEN 1 END) as cancelled_orders,
  -- Performance metrics
  COALESCE(AVG(CASE WHEN o.status = 'finalizada' 
                    THEN EXTRACT(EPOCH FROM (o.updated_at - o.created_at))/3600 
                    ELSE NULL END), 0) as avg_completion_hours,
  COALESCE(AVG(tss.overall_recommendation), 0) as avg_satisfaction,
  -- Financial contribution
  COALESCE(SUM(oi.total_amount), 0) as total_revenue_generated,
  -- Skills metrics
  COUNT(DISTINCT ts.service_type_id) as total_skills,
  COALESCE(AVG(ts.skill_level), 0) as avg_skill_level,
  -- Current workload
  COUNT(CASE WHEN o.status IN ('pendiente', 'en_proceso', 'en_camino') THEN 1 END) as current_workload
FROM public.profiles p
LEFT JOIN public.orders o ON o.assigned_technician = p.user_id
LEFT JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.technician_satisfaction_surveys tss ON tss.order_id = o.id
LEFT JOIN public.technician_skills ts ON ts.technician_id = p.user_id
WHERE p.role = 'tecnico'
GROUP BY p.user_id, p.full_name, p.role;

-- =============================================================================
-- SECTION 3: PERFORMANCE INDEXES
-- =============================================================================

-- Indexes for automation queries
CREATE INDEX IF NOT EXISTS idx_policies_automation 
  ON public.policies(status, start_date, end_date) 
  WHERE status = 'activa';

CREATE INDEX IF NOT EXISTS idx_policy_payments_automation 
  ON public.policy_payments(policy_client_id, payment_date, payment_status);

CREATE INDEX IF NOT EXISTS idx_scheduled_services_automation 
  ON public.scheduled_services(policy_client_id, next_service_date, is_active) 
  WHERE is_active = true;

-- Indexes for financial queries
CREATE INDEX IF NOT EXISTS idx_incomes_date_amount 
  ON public.incomes(income_date DESC, amount);

CREATE INDEX IF NOT EXISTS idx_expenses_date_amount 
  ON public.expenses(expense_date DESC, amount);

CREATE INDEX IF NOT EXISTS idx_financial_projections_period 
  ON public.financial_projections(month, year);

-- Indexes for order performance
CREATE INDEX IF NOT EXISTS idx_orders_status_date 
  ON public.orders(status, created_at DESC, assigned_technician);

CREATE INDEX IF NOT EXISTS idx_order_items_order_type 
  ON public.order_items(order_id, item_type, total_amount);

CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_date 
  ON public.order_status_logs(order_id, created_at DESC);

-- Indexes for technician performance
CREATE INDEX IF NOT EXISTS idx_technician_skills_performance 
  ON public.technician_skills(technician_id, skill_level, service_type_id);

-- Indexes for client and communication
CREATE INDEX IF NOT EXISTS idx_clients_email_status 
  ON public.clients(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_up_reminders_scheduled 
  ON public.follow_up_reminders(scheduled_at, status) 
  WHERE status = 'pending';

-- Composite indexes for complex automation queries
CREATE INDEX IF NOT EXISTS idx_orders_client_technician_status 
  ON public.orders(client_id, assigned_technician, status, created_at);

CREATE INDEX IF NOT EXISTS idx_policies_client_status_dates 
  ON public.policies(client_email, status, start_date, end_date);

-- =============================================================================
-- SECTION 4: QUERY OPTIMIZATION FUNCTIONS
-- =============================================================================

-- Function to get automation metrics efficiently
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

-- Function for efficient cross-module reporting
CREATE OR REPLACE FUNCTION public.get_business_overview(start_date DATE, end_date DATE)
RETURNS TABLE(
  period_revenue NUMERIC,
  period_expenses NUMERIC,
  period_profit NUMERIC,
  active_orders INTEGER,
  completed_orders INTEGER,
  active_policies INTEGER,
  overdue_payments INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT SUM(amount) FROM public.incomes 
              WHERE income_date BETWEEN start_date AND end_date), 0),
    COALESCE((SELECT SUM(amount) FROM public.expenses 
              WHERE expense_date BETWEEN start_date AND end_date), 0),
    COALESCE((SELECT SUM(amount) FROM public.incomes 
              WHERE income_date BETWEEN start_date AND end_date), 0) -
    COALESCE((SELECT SUM(amount) FROM public.expenses 
              WHERE expense_date BETWEEN start_date AND end_date), 0),
    (SELECT COUNT(*)::INTEGER FROM public.orders 
     WHERE status IN ('pendiente', 'en_proceso', 'en_camino')),
    (SELECT COUNT(*)::INTEGER FROM public.orders 
     WHERE status = 'finalizada' 
     AND created_at::DATE BETWEEN start_date AND end_date),
    (SELECT COUNT(*)::INTEGER FROM public.policies WHERE status = 'activa'),
    (SELECT COUNT(*)::INTEGER FROM public.policy_payments 
     WHERE payment_date < CURRENT_DATE - INTERVAL '30 days' 
     AND payment_status != 'paid');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;