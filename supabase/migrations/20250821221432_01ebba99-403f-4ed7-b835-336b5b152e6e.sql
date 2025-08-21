-- Add "pausa" status to order_status enum
ALTER TYPE order_status ADD VALUE 'pausa';

-- Update handle_order_modification trigger to activate items in pause
CREATE OR REPLACE FUNCTION public.handle_order_modification()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_data JSONB;
BEGIN
  -- Only trigger when inserting new order items
  IF TG_OP = 'INSERT' THEN
    -- Get item data for the modification log
    SELECT to_jsonb(NEW) INTO item_data;
    
    -- Insert modification record
    INSERT INTO order_modifications (
      order_id,
      modification_type,
      items_added,
      created_by
    ) VALUES (
      NEW.order_id,
      'item_added',
      item_data,
      auth.uid()
    );
    
    -- Only change order status if there are items in pause status
    IF NEW.status = 'pausa' THEN
      -- Update order status to require approval
      UPDATE orders 
      SET status = 'pendiente_aprobacion',
          updated_at = now()
      WHERE id = NEW.order_id 
        AND status != 'pendiente_aprobacion';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;