-- Create table for tracking order modifications
CREATE TABLE IF NOT EXISTS public.order_modifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  modification_type TEXT NOT NULL DEFAULT 'item_added',
  previous_total NUMERIC,
  new_total NUMERIC,
  items_added JSONB,
  items_removed JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  client_approved BOOLEAN DEFAULT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.order_modifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can manage order modifications" 
ON public.order_modifications 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));

CREATE POLICY "Clients can view modifications for their orders" 
ON public.order_modifications 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM orders o 
  JOIN clients c ON c.id = o.client_id 
  JOIN profiles p ON p.email = c.email 
  WHERE o.id = order_modifications.order_id 
  AND p.user_id = auth.uid()
));

-- Function to handle order modifications
CREATE OR REPLACE FUNCTION public.handle_order_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- If items are added to an existing order, change status to pendiente_aprobacion
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM orders WHERE id = NEW.order_id AND status != 'pendiente_aprobacion'
  ) THEN
    UPDATE orders 
    SET status = 'pendiente_aprobacion'::order_status,
        updated_at = now()
    WHERE id = NEW.order_id;
    
    -- Log the modification
    INSERT INTO order_modifications (
      order_id, 
      modification_type, 
      items_added, 
      created_by
    ) VALUES (
      NEW.order_id,
      'item_added',
      jsonb_build_object(
        'service_name', NEW.service_name,
        'quantity', NEW.quantity,
        'total_amount', NEW.total_amount
      ),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;