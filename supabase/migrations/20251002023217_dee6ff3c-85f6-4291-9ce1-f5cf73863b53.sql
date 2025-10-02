-- Create function to generate sequential policy order numbers
CREATE OR REPLACE FUNCTION public.generate_policy_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_order_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Get the highest policy order number
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(order_number FROM 'ORD-POL-(.*)') AS INTEGER
      )
    ), 
    0
  ) + 1
  INTO max_order_num
  FROM public.orders
  WHERE order_number LIKE 'ORD-POL-%'
  AND order_number ~ 'ORD-POL-[0-9]+$'; -- Only match numeric suffixes
  
  new_order_number := 'ORD-POL-' || LPAD(max_order_num::TEXT, 6, '0');
  
  RETURN new_order_number;
END;
$$;