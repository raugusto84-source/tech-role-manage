-- Create table for order authorization signatures
CREATE TABLE public.order_authorization_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  client_signature_data TEXT NOT NULL,
  client_name TEXT NOT NULL,
  authorization_notes TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_authorization_signatures ENABLE ROW LEVEL SECURITY;

-- Create policies for authorization signatures
CREATE POLICY "Clients can create authorization signatures for their orders"
ON public.order_authorization_signatures
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE o.id = order_authorization_signatures.order_id
    AND p.user_id = auth.uid()
    AND p.role = 'cliente'
  )
);

CREATE POLICY "Clients can view authorization signatures for their orders"
ON public.order_authorization_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE o.id = order_authorization_signatures.order_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view all authorization signatures"
ON public.order_authorization_signatures
FOR SELECT
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'tecnico'::text, 'vendedor'::text])
);

-- Create function to update order status after authorization signature
CREATE OR REPLACE FUNCTION public.approve_order_after_signature()
RETURNS TRIGGER AS $$
BEGIN
  -- Update order status from pendiente_aprobacion to pendiente
  UPDATE public.orders 
  SET 
    status = 'pendiente'::order_status,
    updated_at = now()
  WHERE id = NEW.order_id 
  AND status = 'pendiente_aprobacion'::order_status;
  
  -- Log the approval
  INSERT INTO public.order_status_logs (
    order_id,
    previous_status,
    new_status,
    changed_by,
    notes
  ) VALUES (
    NEW.order_id,
    'pendiente_aprobacion'::order_status,
    'pendiente'::order_status,
    auth.uid(),
    'Orden autorizada mediante firma del cliente: ' || NEW.client_name
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-approval after signature
CREATE TRIGGER approve_order_after_authorization_signature
  AFTER INSERT ON public.order_authorization_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.approve_order_after_signature();