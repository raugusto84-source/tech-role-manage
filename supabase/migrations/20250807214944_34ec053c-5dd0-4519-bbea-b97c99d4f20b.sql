-- Let's create a simple test and also verify what's happening
-- First, let's add some debug logging to understand where the error comes from

-- Create a simple function that just returns the user role without any complex logic
CREATE OR REPLACE FUNCTION public.get_simple_user_role()
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(role::text, 'cliente'::text)
  FROM public.profiles 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Let's create a temporary super simple policy just for technicians to test
DROP POLICY IF EXISTS "technicians_update_assigned" ON orders;

-- Create the simplest possible update policy for technicians
CREATE POLICY "technicians_simple_update" 
ON orders 
FOR UPDATE 
USING (
  -- Just check if user is technician and assigned to this order
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'tecnico'
  ) 
  AND assigned_technician = auth.uid()
);

-- Let's also check if there are any other tables that might be interfering
-- Add a log to see what policies are being evaluated
CREATE OR REPLACE FUNCTION public.debug_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Log the update attempt
  RAISE LOG 'Order update attempt - Order ID: %, User: %, New Status: %', 
    NEW.id, 
    auth.uid(), 
    NEW.status;
  
  RETURN NEW;
END;
$$;

-- Create a trigger to debug what's happening
DROP TRIGGER IF EXISTS debug_order_update_trigger ON orders;
CREATE TRIGGER debug_order_update_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION debug_order_update();