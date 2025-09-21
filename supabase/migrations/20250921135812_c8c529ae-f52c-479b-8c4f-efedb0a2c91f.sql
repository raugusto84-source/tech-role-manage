-- Función para calcular cashback basado en el costo estimado de la orden
CREATE OR REPLACE FUNCTION public.calculate_order_cashback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reward_settings_record RECORD;
  cashback_amount NUMERIC := 0;
  has_existing_cashback BOOLEAN := false;
BEGIN
  -- Solo procesar cuando la orden se finaliza
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    -- Verificar si ya existe cashback para esta orden
    SELECT EXISTS (
      SELECT 1 FROM public.reward_transactions 
      WHERE order_id = NEW.id 
        AND transaction_type = 'earned'
        AND description LIKE 'Cashback por orden%'
    ) INTO has_existing_cashback;

    IF has_existing_cashback THEN
      RAISE LOG 'Cashback already processed for order %, skipping duplicate', NEW.order_number;
      RETURN NEW;
    END IF;

    -- Obtener configuración de rewards activa
    SELECT * INTO reward_settings_record 
    FROM public.reward_settings 
    WHERE is_active = true 
    ORDER BY COALESCE(updated_at, created_at) DESC 
    LIMIT 1;

    -- Solo procesar si hay configuración activa y se debe aplicar cashback
    IF reward_settings_record.id IS NOT NULL AND reward_settings_record.apply_cashback_to_items THEN
      -- Calcular cashback basado en el costo estimado de la orden (no en la suma de items)
      cashback_amount := NEW.estimated_cost * (reward_settings_record.general_cashback_percent / 100.0);
      
      -- Insertar transacción de cashback
      INSERT INTO public.reward_transactions (
        client_id,
        transaction_type,
        amount,
        description,
        order_id,
        expires_at
      ) VALUES (
        NEW.client_id,
        'earned',
        cashback_amount,
        'Cashback por orden #' || NEW.order_number || ' (' || reward_settings_record.general_cashback_percent || '%)',
        NEW.id,
        now() + INTERVAL '1 year'
      );

      RAISE LOG 'Cashback calculated for order %: % * % = %', 
        NEW.order_number, 
        NEW.estimated_cost, 
        reward_settings_record.general_cashback_percent,
        cashback_amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Crear trigger para el cálculo automático de cashback
DROP TRIGGER IF EXISTS calculate_order_cashback_trigger ON public.orders;
CREATE TRIGGER calculate_order_cashback_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_order_cashback();