-- Modify the auto_complete_order trigger to NOT create automatic income
-- when order is completed, so it goes to pending collections instead

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
        RAISE LOG 'Order % status updated to finalizada - READY FOR COLLECTION', NEW.order_id;
        
        -- REMOVED: No longer create automatic payment and income records
        -- Order will now appear in pending_collections for manual collection
        
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