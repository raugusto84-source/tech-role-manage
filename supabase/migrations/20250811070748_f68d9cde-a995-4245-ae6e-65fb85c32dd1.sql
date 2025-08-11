-- Crear tabla para firmas de conformidad de entrega
CREATE TABLE public.delivery_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  client_signature_data TEXT NOT NULL,
  client_name TEXT NOT NULL,
  delivery_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en la tabla de firmas de entrega
ALTER TABLE public.delivery_signatures ENABLE ROW LEVEL SECURITY;

-- Política para que los clientes puedan crear firmas de entrega para sus órdenes
CREATE POLICY "Clients can create delivery signatures for their orders" 
ON public.delivery_signatures 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN profiles p ON p.email = c.email
    WHERE o.id = delivery_signatures.order_id 
    AND p.user_id = auth.uid()
    AND o.status = 'pendiente_entrega'::order_status
  )
);

-- Política para que los usuarios puedan ver las firmas de entrega de órdenes a las que tienen acceso
CREATE POLICY "Users can view delivery signatures for accessible orders" 
ON public.delivery_signatures 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN profiles p ON p.user_id = auth.uid()
    WHERE o.id = delivery_signatures.order_id 
    AND (
      o.assigned_technician = auth.uid() OR 
      p.role = 'administrador'::user_role OR 
      (p.role = 'cliente'::user_role AND c.email = p.email)
    )
  )
);

-- Staff puede ver todas las firmas de entrega
CREATE POLICY "Staff can view all delivery signatures" 
ON public.delivery_signatures 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'tecnico'::user_role, 'vendedor'::user_role])
  )
);