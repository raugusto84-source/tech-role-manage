-- Eliminar vista existente para crear tabla real
DROP VIEW IF EXISTS public.pending_collections CASCADE;

-- Crear tabla pending_collections
CREATE TABLE public.pending_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid UNIQUE NOT NULL,
  order_number text NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  estimated_cost numeric NOT NULL DEFAULT 0,
  delivery_date date,
  total_paid numeric NOT NULL DEFAULT 0,
  remaining_balance numeric NOT NULL DEFAULT 0,
  total_vat_amount numeric NOT NULL DEFAULT 0,
  subtotal_without_vat numeric NOT NULL DEFAULT 0,
  total_with_vat numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pending_collections ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS
CREATE POLICY "Staff can manage pending collections" 
ON public.pending_collections 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'supervisor'::text]));

CREATE POLICY "Clients can view their own pending collections" 
ON public.pending_collections 
FOR SELECT 
USING (client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()));