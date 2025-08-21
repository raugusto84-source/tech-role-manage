-- Update handle_order_modification to NOT change order status automatically
CREATE OR REPLACE FUNCTION public.handle_order_modification()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Log full item payload
    SELECT to_jsonb(NEW) INTO item_data;

    -- Register modification
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

    -- Do NOT alter orders.status here
  END IF;

  RETURN NEW;
END;
$$;