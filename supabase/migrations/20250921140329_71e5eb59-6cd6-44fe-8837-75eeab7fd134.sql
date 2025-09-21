-- Eliminar el trigger anterior que se ejecutaba al finalizar la orden
DROP TRIGGER IF EXISTS calculate_order_cashback_trigger ON public.orders;

-- Función para calcular cashback cuando se firma la orden de recibido
CREATE OR REPLACE FUNCTION public.calculate_cashback_on_delivery_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reward_settings_record RECORD;
  order_record RECORD;
  cashback_amount NUMERIC := 0;
  has_existing_cashback BOOLEAN := false;
BEGIN
  -- Obtener información de la orden relacionada
  SELECT * INTO order_record 
  FROM public.orders 
  WHERE id = NEW.order_id;

  IF order_record.id IS NULL THEN
    RAISE LOG 'Order not found for delivery signature: %', NEW.order_id;
    RETURN NEW;
  END IF;

  -- Verificar si ya existe cashback para esta orden
  SELECT EXISTS (
    SELECT 1 FROM public.reward_transactions 
    WHERE order_id = NEW.order_id 
      AND transaction_type = 'earned'
      AND description LIKE 'Cashback por orden%'
  ) INTO has_existing_cashback;

  IF has_existing_cashback THEN
    RAISE LOG 'Cashback already processed for order %, skipping duplicate', order_record.order_number;
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
    -- Calcular cashback basado en el costo estimado de la orden
    cashback_amount := order_record.estimated_cost * (reward_settings_record.general_cashback_percent / 100.0);
    
    -- Insertar transacción de cashback
    INSERT INTO public.reward_transactions (
      client_id,
      transaction_type,
      amount,
      description,
      order_id,
      expires_at
    ) VALUES (
      order_record.client_id,
      'earned',
      cashback_amount,
      'Cashback por orden #' || order_record.order_number || ' (' || reward_settings_record.general_cashback_percent || '%)',
      NEW.order_id,
      now() + INTERVAL '1 year'
    );

    RAISE LOG 'Cashback calculated on delivery signature for order %: % * % = %', 
      order_record.order_number, 
      order_record.estimated_cost, 
      reward_settings_record.general_cashback_percent,
      cashback_amount;
  END IF;

  RETURN NEW;
END;
$function$;

-- Crear trigger para ejecutar al insertar firma de entrega
CREATE TRIGGER calculate_cashback_on_delivery_signature_trigger
  AFTER INSERT ON public.delivery_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_cashback_on_delivery_signature();