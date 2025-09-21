-- Add 'rechazada' status to order_status enum
ALTER TYPE order_status ADD VALUE 'rechazada';

-- Create order rejections table to track rejection reasons
CREATE TABLE IF NOT EXISTS public.order_rejections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rejected_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT NOT NULL,
  rejection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on order_rejections
ALTER TABLE public.order_rejections ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_rejections
CREATE POLICY "Users can view order rejections they have access to"
ON public.order_rejections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    LEFT JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_rejections.order_id
    AND (
      o.assigned_technician = auth.uid() OR
      p.role = 'administrador' OR
      (p.role = 'cliente' AND c.email = p.email)
    )
  )
);

CREATE POLICY "Clients can reject their own orders"
ON public.order_rejections FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE o.id = order_rejections.order_id
    AND p.user_id = auth.uid()
    AND o.status IN ('pendiente_aprobacion', 'pendiente_actualizacion')
  )
);

CREATE POLICY "Staff can create order rejections"
ON public.order_rejections FOR INSERT
WITH CHECK (
  get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text])
);

-- Function to handle order rejection
CREATE OR REPLACE FUNCTION public.reject_order(p_order_id UUID, p_rejection_reason TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  order_record RECORD;
  client_record RECORD;
BEGIN
  -- Get order info
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = p_order_id;
  
  IF order_record.id IS NULL THEN
    RETURN json_build_object('error', 'Orden no encontrada');
  END IF;
  
  -- Check if order can be rejected
  IF order_record.status NOT IN ('pendiente_aprobacion', 'pendiente_actualizacion') THEN
    RETURN json_build_object('error', 'Esta orden no puede ser rechazada en su estado actual');
  END IF;
  
  -- Get client info
  SELECT * INTO client_record
  FROM public.clients
  WHERE id = order_record.client_id;
  
  -- Check permissions - client can reject their own order or staff can reject any order
  IF NOT (
    (get_current_user_role() = 'cliente' AND 
     EXISTS (
       SELECT 1 FROM public.profiles p 
       WHERE p.user_id = auth.uid() AND p.email = client_record.email
     )) OR
    get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text])
  ) THEN
    RETURN json_build_object('error', 'No tiene permisos para rechazar esta orden');
  END IF;
  
  -- Update order status to rejected
  UPDATE public.orders
  SET status = 'rechazada',
      updated_at = now()
  WHERE id = p_order_id;
  
  -- Create rejection record
  INSERT INTO public.order_rejections (
    order_id,
    rejected_by,
    rejection_reason
  ) VALUES (
    p_order_id,
    auth.uid(),
    p_rejection_reason
  );
  
  -- Log status change
  INSERT INTO public.order_status_logs (
    order_id,
    previous_status,
    new_status,
    changed_by,
    notes
  ) VALUES (
    p_order_id,
    order_record.status,
    'rechazada',
    auth.uid(),
    'Orden rechazada: ' || p_rejection_reason
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Orden rechazada exitosamente',
    'order_number', order_record.order_number
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', 'Error interno: ' || SQLERRM);
END;
$$;