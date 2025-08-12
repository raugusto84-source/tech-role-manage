-- Add RLS policies for clients to access their orders and quotes

-- Policy for clients to view their own orders
CREATE POLICY "Clients can view their own orders" 
ON public.orders FOR SELECT 
USING (
  client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid() AND p.role = 'cliente'
  )
);

-- Policy for clients to view their own quotes  
CREATE POLICY "Clients can view their own quotes" 
ON public.quotes FOR SELECT 
USING (
  user_id = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'cliente'
  )
);

-- Policy for clients to update their own orders (for approval)
CREATE POLICY "Clients can update their own orders for approval" 
ON public.orders FOR UPDATE 
USING (
  client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid() AND p.role = 'cliente'
  )
) 
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid() AND p.role = 'cliente'
  )
);