-- Agregar campo de conformidad del cliente a las órdenes
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_approval BOOLEAN DEFAULT NULL;

-- Agregar campo para notas de conformidad del cliente
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_approval_notes TEXT DEFAULT NULL;

-- Agregar timestamp de cuando el cliente dio conformidad
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Crear tabla para solicitudes de orden del cliente
CREATE TABLE IF NOT EXISTS public.order_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_address TEXT NOT NULL,
  service_description TEXT NOT NULL,
  failure_description TEXT NOT NULL,
  requested_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  preferred_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'asignada', 'rechazada')),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en order_requests
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

-- Políticas para order_requests
CREATE POLICY "Clients can create order requests" 
ON public.order_requests 
FOR INSERT 
WITH CHECK (true); -- Cualquier cliente puede crear solicitudes

CREATE POLICY "Staff can view all order requests" 
ON public.order_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'tecnico'::user_role])
  )
);

CREATE POLICY "Staff can manage order requests" 
ON public.order_requests 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'tecnico'::user_role])
  )
);