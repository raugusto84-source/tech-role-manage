-- A. FINANZAS AUTOMATION: Create triggers and functions for automatic finance integration

-- 1. Function to generate automatic income when policy payment is processed
CREATE OR REPLACE FUNCTION public.process_policy_payment_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a policy payment is marked as paid, create an income record
  IF NEW.is_paid = true AND OLD.is_paid = false THEN
    INSERT INTO public.incomes (
      amount,
      description,
      category,
      account_type,
      payment_method,
      income_date,
      status,
      created_by
    ) VALUES (
      NEW.amount,
      'Pago de póliza - ' || (
        SELECT CONCAT(ip.policy_name, ' (', ip.policy_number, ')')
        FROM policy_clients pc
        JOIN insurance_policies ip ON ip.id = pc.policy_id
        WHERE pc.id = NEW.policy_client_id
      ),
      'polizas',
      NEW.account_type,
      NEW.payment_method,
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'cobrado',
      NEW.created_by
    );
    
    -- Log the automatic finance integration
    RAISE LOG 'Automatic income created for policy payment ID: %, Amount: %', NEW.id, NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Function to generate recurring income projections for active policies
CREATE OR REPLACE FUNCTION public.generate_policy_income_projections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  policy_record RECORD;
  projection_months INTEGER := 12; -- Project 12 months ahead
  current_month DATE;
  i INTEGER;
BEGIN
  -- For each active policy, create projected income records
  FOR policy_record IN 
    SELECT 
      ip.id,
      ip.policy_name,
      ip.policy_number,
      ip.monthly_fee,
      COUNT(pc.id) as client_count
    FROM insurance_policies ip
    JOIN policy_clients pc ON pc.policy_id = ip.id AND pc.is_active = true
    WHERE ip.is_active = true
    GROUP BY ip.id, ip.policy_name, ip.policy_number, ip.monthly_fee
  LOOP
    -- Create projections for the next 12 months
    FOR i IN 1..projection_months LOOP
      current_month := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' * i;
      
      -- Insert projected income if not already exists
      INSERT INTO public.incomes (
        amount,
        description,
        category,
        account_type,
        income_date,
        status,
        created_by
      ) 
      SELECT 
        policy_record.monthly_fee * policy_record.client_count,
        'Proyección - ' || policy_record.policy_name || ' (' || policy_record.policy_number || ')',
        'polizas_proyectadas',
        'no_fiscal',
        current_month,
        'proyectado',
        '00000000-0000-0000-0000-000000000000'::uuid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.incomes 
        WHERE category = 'polizas_proyectadas' 
        AND description LIKE '%' || policy_record.policy_number || '%'
        AND DATE_TRUNC('month', income_date) = current_month
      );
    END LOOP;
  END LOOP;
  
  RAISE LOG 'Policy income projections generated for % policies', (SELECT COUNT(*) FROM insurance_policies WHERE is_active = true);
END;
$$;

-- 3. Function to generate payment overdue alerts
CREATE OR REPLACE FUNCTION public.generate_payment_overdue_alerts()
RETURNS TABLE(
  policy_name text,
  client_name text,
  client_email text,
  amount numeric,
  days_overdue integer,
  alert_priority text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ip.policy_name,
    pc.client_name,
    pc.client_email,
    pp.amount,
    (CURRENT_DATE - pp.due_date)::integer as days_overdue,
    CASE 
      WHEN (CURRENT_DATE - pp.due_date) > 30 THEN 'CRÍTICO'
      WHEN (CURRENT_DATE - pp.due_date) > 15 THEN 'ALTO'
      WHEN (CURRENT_DATE - pp.due_date) > 7 THEN 'MEDIO'
      ELSE 'BAJO'
    END as alert_priority
  FROM policy_payments pp
  JOIN policy_clients pc ON pc.id = pp.policy_client_id
  JOIN insurance_policies ip ON ip.id = pc.policy_id
  WHERE pp.is_paid = false 
    AND pp.payment_status = 'vencido'
    AND pp.due_date < CURRENT_DATE
  ORDER BY (CURRENT_DATE - pp.due_date) DESC;
END;
$$;

-- Create trigger for automatic finance integration
CREATE TRIGGER trigger_process_policy_payment_to_finance
  AFTER UPDATE ON policy_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_policy_payment_to_finance();

-- B. ORDERS AUTOMATION: Functions for automatic order generation

-- 1. Function to generate automatic orders based on scheduled services
CREATE OR REPLACE FUNCTION public.generate_automatic_orders_from_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_record RECORD;
  new_order_id uuid;
  assigned_technician_id uuid;
  service_type_id uuid;
BEGIN
  -- Get default service type for policy services
  SELECT id INTO service_type_id
  FROM service_types
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  -- Find scheduled services that are due
  FOR service_record IN
    SELECT 
      ss.id,
      ss.service_description,
      ss.next_service_date,
      pc.id as policy_client_id,
      pc.client_name,
      pc.client_email,
      pc.client_phone,
      pc.property_address,
      ip.policy_name,
      ip.description as policy_description
    FROM scheduled_services ss
    JOIN policy_clients pc ON pc.id = ss.policy_client_id
    JOIN insurance_policies ip ON ip.id = pc.policy_id
    WHERE ss.is_active = true
      AND ss.next_service_date <= CURRENT_DATE + INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.client_id::text = pc.id::text 
        AND o.status IN ('pendiente', 'en_proceso', 'en_camino')
        AND DATE(o.created_at) = ss.next_service_date
      )
  LOOP
    -- Find optimal technician for this service
    SELECT technician_id INTO assigned_technician_id
    FROM suggest_optimal_technician(service_type_id, service_record.next_service_date)
    ORDER BY score DESC
    LIMIT 1;

    -- Create or find client record
    DECLARE
      client_record_id uuid;
    BEGIN
      SELECT id INTO client_record_id
      FROM clients
      WHERE email = service_record.client_email
      LIMIT 1;
      
      IF client_record_id IS NULL THEN
        INSERT INTO clients (name, email, phone, address)
        VALUES (
          service_record.client_name,
          service_record.client_email,
          service_record.client_phone,
          service_record.property_address
        ) RETURNING id INTO client_record_id;
      END IF;

      -- Create automatic order
      INSERT INTO orders (
        client_id,
        service_type,
        failure_description,
        estimated_cost,
        delivery_date,
        assigned_technician,
        status,
        client_approval
      ) VALUES (
        client_record_id,
        service_type_id,
        'Servicio programado: ' || service_record.service_description || ' - ' || service_record.policy_name,
        0, -- Will be calculated later
        service_record.next_service_date + INTERVAL '1 day',
        assigned_technician_id,
        'pendiente_aprobacion',
        true -- Auto-approved for policy services
      ) RETURNING id INTO new_order_id;

      -- Create order item for policy service
      INSERT INTO order_items (
        order_id,
        service_type_id,
        service_name,
        service_description,
        quantity,
        unit_cost_price,
        unit_base_price,
        subtotal,
        total_amount,
        item_type,
        status
      ) VALUES (
        new_order_id,
        service_type_id,
        'Servicio de Póliza',
        service_record.service_description,
        1,
        0,
        0,
        0,
        0,
        'servicio',
        'pendiente'
      );

      -- Update scheduled service next date
      UPDATE scheduled_services
      SET 
        next_service_date = next_service_date + INTERVAL '1 month',
        updated_at = now()
      WHERE id = service_record.id;

      -- Log automatic order creation
      RAISE LOG 'Automatic order created: ID %, for policy client %, assigned to technician %', 
        new_order_id, service_record.policy_client_id, assigned_technician_id;
    END;
  END LOOP;
END;
$$;