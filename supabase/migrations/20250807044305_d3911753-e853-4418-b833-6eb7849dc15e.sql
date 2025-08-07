-- Update other policies that depend on client_email
DROP POLICY IF EXISTS "Clients can view their own order diagnostics" ON public.order_diagnostics;
DROP POLICY IF EXISTS "Clients can view their own order signatures" ON public.order_signatures;

-- Create new policies using client relationship through orders
CREATE POLICY "Clients can view their own order diagnostics" 
ON public.order_diagnostics 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente'::text) AND 
  (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    WHERE o.id = order_diagnostics.order_id 
    AND c.email = (
      SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid()
    )
  ))
);

CREATE POLICY "Clients can view their own order signatures" 
ON public.order_signatures 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente'::text) AND 
  (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    WHERE o.id = order_signatures.order_id 
    AND c.email = (
      SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid()
    )
  ))
);