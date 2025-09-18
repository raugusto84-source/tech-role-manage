-- Allow clients to view order payments for their own orders
CREATE POLICY "Clients can view their own order payments"
ON public.order_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE o.id = order_payments.order_id 
    AND p.user_id = auth.uid()
    AND p.role = 'cliente'
  )
);