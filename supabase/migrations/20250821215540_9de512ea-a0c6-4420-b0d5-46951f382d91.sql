-- Fix the security issue with handle_order_modification function
CREATE OR REPLACE FUNCTION public.handle_order_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- If items are added to an existing order, change status to pendiente_aprobacion
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM orders WHERE id = NEW.order_id AND status != 'pendiente_aprobacion'
  ) THEN
    UPDATE orders 
    SET status = 'pendiente_aprobacion'::order_status,
        updated_at = now()
    WHERE id = NEW.order_id;
    
    -- Log the modification
    INSERT INTO order_modifications (
      order_id, 
      modification_type, 
      items_added, 
      created_by
    ) VALUES (
      NEW.order_id,
      'item_added',
      jsonb_build_object(
        'service_name', NEW.service_name,
        'quantity', NEW.quantity,
        'total_amount', NEW.total_amount
      ),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Create trigger for order_items
DROP TRIGGER IF EXISTS trigger_handle_order_modification ON public.order_items;
CREATE TRIGGER trigger_handle_order_modification
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_modification();