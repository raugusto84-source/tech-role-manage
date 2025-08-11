-- Agregar logs al trigger para diagnosticar el problema
CREATE OR REPLACE FUNCTION public.auto_complete_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_items INTEGER;
  completed_items INTEGER;
  order_total NUMERIC;
  client_info RECORD;
BEGIN
  -- Log para debugging
  RAISE LOG 'auto_complete_order triggered: TG_OP=%, OLD.status=%, NEW.status=%', 
    TG_OP, OLD.status, NEW.status;
  
  -- Solo procesar cuando se actualiza el estado de un item a 'finalizada'
  IF TG_OP = 'UPDATE' AND NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    RAISE LOG 'Processing order completion for order_id=%', NEW.order_id;
    
    -- Contar total de items y items finalizados para esta orden
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'finalizada' THEN 1 END) as completed
    INTO total_items, completed_items
    FROM order_items 
    WHERE order_id = NEW.order_id;
    
    RAISE LOG 'Order % - Total items: %, Completed items: %', 
      NEW.order_id, total_items, completed_items;
    
    -- Si todos los items están finalizados, finalizar la orden
    IF total_items = completed_items THEN
      
      RAISE LOG 'All items completed, finalizing order %', NEW.order_id;
      
      -- Actualizar estado de la orden a finalizada
      UPDATE orders 
      SET status = 'finalizada', 
          updated_at = now()
      WHERE id = NEW.order_id 
        AND status != 'finalizada'; -- Solo si no está ya finalizada
      
      -- Si se actualizó la orden (no estaba ya finalizada)
      IF FOUND THEN
        RAISE LOG 'Order % status updated to finalizada', NEW.order_id;
        
        -- Calcular total de la orden
        SELECT COALESCE(SUM(total_amount), 0)
        INTO order_total
        FROM order_items
        WHERE order_id = NEW.order_id;
        
        -- Obtener información del cliente
        SELECT 
          o.order_number,
          c.name as client_name,
          c.client_number,
          c.email as client_email
        INTO client_info
        FROM orders o
        JOIN clients c ON c.id = o.client_id
        WHERE o.id = NEW.order_id;
        
        RAISE LOG 'Creating payment record for order % with total %', 
          NEW.order_id, order_total;
        
        -- Crear registro de pago pendiente
        INSERT INTO order_payments (
          order_id,
          order_number,
          client_name,
          payment_amount,
          payment_date,
          account_type,
          description,
          created_by
        ) VALUES (
          NEW.order_id,
          client_info.order_number,
          client_info.client_name,
          order_total,
          CURRENT_DATE,
          'no_fiscal',
          'Pago por servicios completados - Orden: ' || client_info.order_number,
          (SELECT assigned_technician FROM orders WHERE id = NEW.order_id)
        );
        
        -- Crear registro de ingreso automático
        INSERT INTO incomes (
          amount,
          description,
          category,
          income_date,
          account_type,
          status,
          client_name,
          created_by
        ) VALUES (
          order_total,
          'Ingreso por orden completada: ' || client_info.order_number,
          'servicios',
          CURRENT_DATE,
          'no_fiscal',
          'pendiente',
          client_info.client_name,
          (SELECT assigned_technician FROM orders WHERE id = NEW.order_id)
        );
        
        RAISE LOG 'Payment and income records created for order %', NEW.order_id;
        
      ELSE
        RAISE LOG 'Order % was already in finalizada status', NEW.order_id;
      END IF;
    ELSE
      RAISE LOG 'Not all items completed yet for order %', NEW.order_id;
    END IF;
  ELSE
    RAISE LOG 'Trigger conditions not met for auto completion';
  END IF;
  
  RETURN NEW;
END;
$function$;