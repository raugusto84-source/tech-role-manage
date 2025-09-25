-- Eliminar función existente y recrearla con nuevo tipo de retorno
DROP FUNCTION IF EXISTS public.generate_monthly_policy_payments();

-- Crear trigger para generar automáticamente el primer pago al asignar una póliza a un cliente
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  policy_data RECORD;
  current_month INTEGER;
  current_year INTEGER;
BEGIN
  -- Solo crear pago si la asignación es nueva y activa
  IF NEW.is_active = true AND (OLD IS NULL OR OLD.is_active = false) THEN
    
    -- Obtener datos de la póliza
    SELECT monthly_fee, policy_name
    INTO policy_data
    FROM public.insurance_policies 
    WHERE id = NEW.policy_id;
    
    -- Obtener mes y año actuales
    current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Crear el pago inicial para el mes actual
    INSERT INTO public.policy_payments (
      policy_client_id,
      amount,
      payment_month,
      payment_year,
      due_date,
      payment_status,
      is_paid,
      account_type,
      created_by
    ) VALUES (
      NEW.id,
      policy_data.monthly_fee,
      current_month,
      current_year,
      DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' + INTERVAL '1 day', -- Último día del mes actual
      'pendiente',
      false,
      'no_fiscal',
      NEW.created_by
    )
    ON CONFLICT (policy_client_id, payment_month, payment_year) 
    DO NOTHING; -- Evitar duplicados si ya existe un pago para este mes
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger
DROP TRIGGER IF EXISTS create_initial_payment_trigger ON public.policy_clients;
CREATE TRIGGER create_initial_payment_trigger
  AFTER INSERT OR UPDATE ON public.policy_clients
  FOR EACH ROW 
  EXECUTE FUNCTION public.create_initial_policy_payment();

-- Recrear la función de generación de pagos mensuales con nuevo tipo de retorno
CREATE OR REPLACE FUNCTION public.generate_monthly_policy_payments()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  policy_client_record RECORD;
  next_month INTEGER;
  next_year INTEGER;  
  payments_created INTEGER := 0;
  payments_skipped INTEGER := 0;
  result_json json;
BEGIN
  -- Calcular próximo mes
  IF EXTRACT(MONTH FROM CURRENT_DATE) = 12 THEN
    next_month := 1;
    next_year := EXTRACT(YEAR FROM CURRENT_DATE) + 1;
  ELSE
    next_month := EXTRACT(MONTH FROM CURRENT_DATE) + 1;
    next_year := EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
  
  -- Generar pagos para todos los clientes con pólizas activas
  FOR policy_client_record IN
    SELECT 
      pc.id as policy_client_id,
      pc.created_by,
      ip.monthly_fee,
      ip.policy_name,
      c.name as client_name
    FROM public.policy_clients pc
    JOIN public.insurance_policies ip ON ip.id = pc.policy_id
    JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.is_active = true 
      AND ip.is_active = true
  LOOP
    -- Verificar si ya existe un pago para el próximo mes
    IF NOT EXISTS (
      SELECT 1 FROM public.policy_payments 
      WHERE policy_client_id = policy_client_record.policy_client_id
        AND payment_month = next_month 
        AND payment_year = next_year
    ) THEN
      -- Crear el pago para el próximo mes
      INSERT INTO public.policy_payments (
        policy_client_id,
        amount,
        payment_month,
        payment_year,
        due_date,
        payment_status,
        is_paid,
        account_type,
        created_by
      ) VALUES (
        policy_client_record.policy_client_id,
        policy_client_record.monthly_fee,
        next_month,
        next_year,
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '1 month' - INTERVAL '1 day', -- Último día del próximo mes
        'pendiente',
        false,
        'no_fiscal',
        policy_client_record.created_by
      );
      
      payments_created := payments_created + 1;
    ELSE
      payments_skipped := payments_skipped + 1;
    END IF;
  END LOOP;
  
  -- Marcar pagos vencidos
  UPDATE public.policy_payments 
  SET payment_status = 'vencido'
  WHERE due_date < CURRENT_DATE 
    AND payment_status = 'pendiente' 
    AND is_paid = false;
  
  -- Construir resultado
  result_json := json_build_object(
    'success', true,
    'payments_created', payments_created,
    'payments_skipped', payments_skipped,
    'next_month', next_month,
    'next_year', next_year,
    'execution_date', CURRENT_TIMESTAMP
  );
  
  RETURN result_json;
END;
$$;