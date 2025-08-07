-- Fix the order number generation function to handle gaps from deleted orders
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_year TEXT;
  max_order_num INTEGER;
  order_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the highest order number for current year, handling the case where orders might be deleted
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(order_number FROM 'ORD-' || current_year || '-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_order_num
  FROM public.orders
  WHERE order_number LIKE 'ORD-' || current_year || '-%';
  
  order_number := 'ORD-' || current_year || '-' || LPAD(max_order_num::TEXT, 4, '0');
  
  RETURN order_number;
END;
$$;