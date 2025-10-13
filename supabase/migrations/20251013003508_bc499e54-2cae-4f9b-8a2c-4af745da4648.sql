-- 1. Actualizar generate_income_number para usar 5 dígitos
CREATE OR REPLACE FUNCTION public.generate_income_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year TEXT;
  max_income_num INTEGER;
  new_income_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the highest income number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(income_number FROM 'ING-' || current_year || '-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_income_num
  FROM public.incomes
  WHERE income_number LIKE 'ING-' || current_year || '-%';
  
  -- Changed from 4 to 5 digits
  new_income_number := 'ING-' || current_year || '-' || LPAD(max_income_num::TEXT, 5, '0');
  
  RETURN new_income_number;
END;
$$;

-- 2. Actualizar generate_policy_order_number para usar 5 dígitos
CREATE OR REPLACE FUNCTION public.generate_policy_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_order_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Get the highest policy order number
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(order_number FROM 'ORD-POL-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_order_num
  FROM public.orders
  WHERE order_number LIKE 'ORD-POL-%'
  AND order_number ~ 'ORD-POL-[0-9]+$'; -- Only match numeric suffixes
  
  -- Changed from 6 to 5 digits
  new_order_number := 'ORD-POL-' || LPAD(max_order_num::TEXT, 5, '0');
  
  RETURN new_order_number;
END;
$$;

-- 3. Crear función para detectar pagos vencidos y generar notificaciones
CREATE OR REPLACE FUNCTION public.check_overdue_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  overdue_record RECORD;
BEGIN
  -- Check for overdue order payments
  FOR overdue_record IN 
    SELECT 
      pc.id,
      pc.order_id,
      pc.order_number,
      pc.client_name,
      pc.amount_pending,
      pc.due_date
    FROM pending_collections pc
    WHERE pc.collection_type = 'order_payment'
      AND pc.status = 'pending'
      AND pc.due_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 
        FROM financial_notifications fn
        WHERE fn.related_id = pc.order_id::text
          AND fn.notification_type = 'overdue_payment'
          AND fn.created_at::date = CURRENT_DATE
      )
  LOOP
    -- Create notification for overdue payment
    INSERT INTO financial_notifications (
      notification_type,
      title,
      description,
      amount,
      related_id,
      priority,
      is_read
    ) VALUES (
      'overdue_payment',
      'Pago vencido - Orden ' || overdue_record.order_number,
      'Cliente: ' || overdue_record.client_name || '. Vencimiento: ' || overdue_record.due_date::text,
      overdue_record.amount_pending,
      overdue_record.order_id::text,
      'urgent',
      false
    );
  END LOOP;

  -- Check for overdue policy payments
  FOR overdue_record IN 
    SELECT 
      pc.id,
      pc.policy_number,
      pc.client_name,
      pc.amount_pending,
      pc.due_date
    FROM pending_collections pc
    WHERE pc.collection_type = 'policy_payment'
      AND pc.status = 'pending'
      AND pc.due_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 
        FROM financial_notifications fn
        WHERE fn.related_id = pc.id::text
          AND fn.notification_type = 'overdue_payment'
          AND fn.created_at::date = CURRENT_DATE
      )
  LOOP
    -- Create notification for overdue policy payment
    INSERT INTO financial_notifications (
      notification_type,
      title,
      description,
      amount,
      related_id,
      priority,
      is_read
    ) VALUES (
      'overdue_payment',
      'Pago vencido - Póliza ' || overdue_record.policy_number,
      'Cliente: ' || overdue_record.client_name || '. Vencimiento: ' || overdue_record.due_date::text,
      overdue_record.amount_pending,
      overdue_record.id::text,
      'urgent',
      false
    );
  END LOOP;
END;
$$;