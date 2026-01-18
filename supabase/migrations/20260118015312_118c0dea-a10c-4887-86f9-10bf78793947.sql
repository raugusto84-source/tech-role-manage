-- Fix the process_policy_order function to remove references to removed cashback columns
CREATE OR REPLACE FUNCTION public.process_policy_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  policy_info RECORD;
  expense_month INTEGER;
  expense_year INTEGER;
  service_total NUMERIC := 0;
  product_total NUMERIC := 0;
BEGIN
  -- Only process if this is a policy order being finalized
  IF NEW.is_policy_order = true AND NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Get policy information
    SELECT ip.*, pc.id as policy_client_id
    INTO policy_info
    FROM public.insurance_policies ip
    JOIN public.policy_clients pc ON pc.policy_id = ip.id
    WHERE ip.id = NEW.policy_id AND pc.client_id = NEW.client_id;
    
    IF policy_info.id IS NOT NULL THEN
      expense_month := EXTRACT(MONTH FROM NEW.created_at);
      expense_year := EXTRACT(YEAR FROM NEW.created_at);
      
      -- Calculate service and product totals
      SELECT 
        COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN oi.item_type = 'producto' THEN oi.total_amount ELSE 0 END), 0)
      INTO service_total, product_total
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id;
      
      -- Record policy expense for reporting
      INSERT INTO public.policy_order_expenses (
        order_id,
        policy_client_id,
        expense_month,
        expense_year,
        service_cost,
        product_cost,
        total_cost
      ) VALUES (
        NEW.id,
        policy_info.policy_client_id,
        expense_month,
        expense_year,
        service_total,
        product_total,
        service_total + product_total
      );
      
      -- Cashback system has been removed - no reward processing needed
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;