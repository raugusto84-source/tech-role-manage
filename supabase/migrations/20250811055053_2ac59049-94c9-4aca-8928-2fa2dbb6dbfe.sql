-- Actualizar función para usar el estado correcto 'finalizada' en lugar de 'completado'
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
  -- Solo procesar cuando se actualiza el estado de un item a 'finalizada'
  IF TG_OP = 'UPDATE' AND NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Contar total de items y items finalizados para esta orden
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'finalizada' THEN 1 END) as completed
    INTO total_items, completed_items
    FROM order_items 
    WHERE order_id = NEW.order_id;
    
    -- Si todos los items están finalizados, finalizar la orden
    IF total_items = completed_items THEN
      
      -- Actualizar estado de la orden a finalizada
      UPDATE orders 
      SET status = 'finalizada', 
          updated_at = now()
      WHERE id = NEW.order_id 
        AND status != 'finalizada'; -- Solo si no está ya finalizada
      
      -- Si se actualizó la orden (no estaba ya finalizada)
      IF FOUND THEN
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
        
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;