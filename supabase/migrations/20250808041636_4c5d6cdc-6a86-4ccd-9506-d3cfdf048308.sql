-- Crear tabla para encuestas de satisfacción
CREATE TABLE public.order_satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  
  -- Evaluación del técnico (1-5 estrellas)
  technician_knowledge INTEGER CHECK (technician_knowledge >= 1 AND technician_knowledge <= 5),
  technician_customer_service INTEGER CHECK (technician_customer_service >= 1 AND technician_customer_service <= 5),
  technician_attitude INTEGER CHECK (technician_attitude >= 1 AND technician_attitude <= 5),
  technician_comments TEXT,
  
  -- Evaluación del ejecutivo de ventas (1-5 estrellas)
  sales_knowledge INTEGER CHECK (sales_knowledge >= 1 AND sales_knowledge <= 5),
  sales_customer_service INTEGER CHECK (sales_customer_service >= 1 AND sales_customer_service <= 5),
  sales_attitude INTEGER CHECK (sales_attitude >= 1 AND sales_attitude <= 5),
  sales_comments TEXT,
  
  -- Evaluación general
  overall_recommendation INTEGER CHECK (overall_recommendation >= 1 AND overall_recommendation <= 5),
  general_comments TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint para asegurar que solo haya una encuesta por orden
  UNIQUE(order_id)
);

-- Enable RLS
ALTER TABLE public.order_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Política para que solo clientes puedan crear encuestas de sus propias órdenes
CREATE POLICY "Clients can create surveys for their closed orders" 
ON public.order_satisfaction_surveys 
FOR INSERT 
WITH CHECK (
  client_id = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM public.orders o 
    JOIN public.clients c ON c.id = o.client_id 
    JOIN public.profiles p ON p.email = c.email 
    WHERE o.id = order_satisfaction_surveys.order_id 
    AND o.status = 'finalizada'
    AND p.user_id = auth.uid()
  )
);

-- Política para que clientes puedan ver sus propias encuestas
CREATE POLICY "Clients can view their own surveys" 
ON public.order_satisfaction_surveys 
FOR SELECT 
USING (
  client_id = auth.uid() OR 
  get_current_user_role() = ANY(ARRAY['administrador'::text, 'tecnico'::text, 'vendedor'::text])
);

-- Política para que staff pueda ver todas las encuestas
CREATE POLICY "Staff can view all surveys" 
ON public.order_satisfaction_surveys 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'tecnico'::text, 'vendedor'::text]));

-- Trigger para updated_at
CREATE TRIGGER update_satisfaction_surveys_updated_at
BEFORE UPDATE ON public.order_satisfaction_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();