-- Allow clients to create order items for their own orders
CREATE POLICY "clients_can_create_order_items" ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE o.id = order_items.order_id 
    AND p.user_id = auth.uid()
    AND p.role = 'cliente'
  )
);