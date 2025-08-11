-- Add a broader policy for administrators to see all orders
CREATE POLICY "Administrators can view all orders" ON public.orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'administrador'::user_role
  )
);

-- Also ensure sales staff can see orders they created
CREATE POLICY "Sales can view orders they created" ON public.orders
FOR SELECT USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'vendedor'::user_role
  )
);