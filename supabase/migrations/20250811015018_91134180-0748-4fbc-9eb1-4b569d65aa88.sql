-- Create table for multiple support technicians per order
CREATE TABLE public.order_support_technicians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reduction_percentage NUMERIC DEFAULT 30.0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, technician_id)
);

-- Enable RLS
ALTER TABLE public.order_support_technicians ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view support technicians for orders they can access" 
ON public.order_support_technicians 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND (
      o.client_id IN (SELECT id FROM public.clients WHERE email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()))
      OR o.assigned_technician = auth.uid()
      OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('administrador', 'vendedor')
    )
  )
);

CREATE POLICY "Admins and sales can manage support technicians" 
ON public.order_support_technicians 
FOR ALL 
USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('administrador', 'vendedor'))
WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('administrador', 'vendedor'));

-- Create index for better performance
CREATE INDEX idx_order_support_technicians_order_id ON public.order_support_technicians(order_id);
CREATE INDEX idx_order_support_technicians_technician_id ON public.order_support_technicians(technician_id);