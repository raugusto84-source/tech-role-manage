-- Create function to track policy savings when order is finalized
CREATE OR REPLACE FUNCTION public.track_policy_savings()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_client_id UUID;
  policy_client_record RECORD;
  order_item RECORD;
  original_price NUMERIC;
  discount_amount NUMERIC;
  client_paid NUMERIC;
  savings NUMERIC;
  is_covered BOOLEAN;
BEGIN
  -- Only process when order status changes to 'finalizada'
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Get the client_id from the order
    order_client_id := NEW.client_id;
    
    -- Check if this client has an active policy
    SELECT pc.id, pc.client_id, ip.policy_name, ip.service_discount_percentage
    INTO policy_client_record
    FROM policy_clients pc
    JOIN insurance_policies ip ON ip.id = pc.policy_id
    WHERE pc.client_id = order_client_id 
    AND pc.is_active = true
    AND pc.start_date <= CURRENT_DATE
    AND (pc.end_date IS NULL OR pc.end_date >= CURRENT_DATE)
    LIMIT 1;
    
    -- If client has an active policy, track savings for each order item
    IF policy_client_record.id IS NOT NULL THEN
      
      -- Loop through all order items
      FOR order_item IN 
        SELECT oi.*, st.name as service_name, st.description as service_description
        FROM order_items oi
        JOIN service_types st ON st.id = oi.service_type_id
        WHERE oi.order_id = NEW.id
      LOOP
        
        -- Calculate original price (what client would pay without policy)
        IF order_item.original_subtotal IS NOT NULL AND order_item.original_subtotal > 0 THEN
          original_price := order_item.original_subtotal;
          discount_amount := COALESCE(order_item.policy_discount_amount, 0);
          client_paid := order_item.total_amount;
          savings := discount_amount;
          is_covered := (order_item.policy_discount_percentage > 0);
        ELSE
          -- If no policy discount was applied, it means service is not covered
          original_price := order_item.total_amount;
          discount_amount := 0;
          client_paid := order_item.total_amount;
          savings := 0;
          is_covered := false;
        END IF;
        
        -- Insert policy expense record
        INSERT INTO policy_expenses (
          policy_client_id,
          order_id,
          service_date,
          service_name,
          service_description,
          original_cost,
          policy_covered_amount,
          client_paid_amount,
          savings_amount,
          is_covered_by_policy,
          month,
          year,
          created_by
        ) VALUES (
          policy_client_record.id,
          NEW.id,
          CURRENT_DATE,
          order_item.service_name,
          order_item.service_description,
          original_price,
          discount_amount,
          client_paid,
          savings,
          is_covered,
          EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
          EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
          auth.uid()
        );
        
      END LOOP;
      
      RAISE LOG 'Policy savings tracked for order % - Client: %, Policy: %', 
        NEW.order_number, policy_client_record.client_id, policy_client_record.policy_name;
        
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to track policy savings
DROP TRIGGER IF EXISTS track_policy_savings_trigger ON orders;
CREATE TRIGGER track_policy_savings_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_policy_savings();