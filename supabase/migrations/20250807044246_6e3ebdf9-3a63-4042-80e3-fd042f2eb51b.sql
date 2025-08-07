-- Update RLS policies to use client_id instead of client_email
DROP POLICY IF EXISTS "Clients can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can update their own orders" ON public.orders;

-- Create new policies using client relationship
CREATE POLICY "Clients can view their own orders" 
ON public.orders 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente'::text) AND 
  (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = orders.client_id 
    AND clients.email = (
      SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid()
    )
  ))
);

CREATE POLICY "Clients can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  (get_current_user_role() = 'cliente'::text) AND 
  (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = orders.client_id 
    AND clients.email = (
      SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid()
    )
  ))
);

CREATE POLICY "Clients can update their own orders" 
ON public.orders 
FOR UPDATE 
USING (
  (get_current_user_role() = 'cliente'::text) AND 
  (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = orders.client_id 
    AND clients.email = (
      SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid()
    )
  ))
);

-- Add delete policy for administrators
CREATE POLICY "Admins can delete orders" 
ON public.orders 
FOR DELETE 
USING (get_current_user_role() = 'administrador'::text);