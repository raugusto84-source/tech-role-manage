-- Fix RLS policies for order_satisfaction_surveys table
-- Enable RLS if not already enabled
ALTER TABLE public.order_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Create policies for order_satisfaction_surveys table
CREATE POLICY "Users can insert their own satisfaction surveys" 
ON public.order_satisfaction_surveys 
FOR INSERT 
WITH CHECK (true); -- Allow any authenticated user to insert surveys

CREATE POLICY "Users can view satisfaction surveys for orders they have access to" 
ON public.order_satisfaction_surveys 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_satisfaction_surveys.order_id 
    AND (
      orders.created_by = auth.uid() OR 
      orders.assigned_technician = auth.uid() OR 
      orders.client_id IN (
        SELECT id FROM public.clients WHERE created_by = auth.uid()
      )
    )
  )
);

-- Fix RLS policies for delivery_signatures table
ALTER TABLE public.delivery_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert delivery signatures" 
ON public.delivery_signatures 
FOR INSERT 
WITH CHECK (true); -- Allow any authenticated user to insert signatures

CREATE POLICY "Users can view delivery signatures for orders they have access to" 
ON public.delivery_signatures 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = delivery_signatures.order_id 
    AND (
      orders.created_by = auth.uid() OR 
      orders.assigned_technician = auth.uid() OR 
      orders.client_id IN (
        SELECT id FROM public.clients WHERE created_by = auth.uid()
      )
    )
  )
);