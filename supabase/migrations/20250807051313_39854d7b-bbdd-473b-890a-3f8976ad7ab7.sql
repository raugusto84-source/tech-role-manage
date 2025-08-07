-- Fix the ambiguous column reference in generate_order_number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_year TEXT;
  max_order_num INTEGER;
  new_order_number TEXT; -- Renamed variable to avoid ambiguity
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the highest order number for current year, handling the case where orders might be deleted
  -- Explicitly qualify the column reference with table alias
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(o.order_number FROM 'ORD-' || current_year || '-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_order_num
  FROM public.orders o
  WHERE o.order_number LIKE 'ORD-' || current_year || '-%';
  
  new_order_number := 'ORD-' || current_year || '-' || LPAD(max_order_num::TEXT, 4, '0');
  
  RETURN new_order_number;
END;
$$;