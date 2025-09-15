-- Create table for storing final order totals as displayed in UI
CREATE TABLE public.order_final_totals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  final_total_amount NUMERIC NOT NULL DEFAULT 0,
  display_subtotal NUMERIC NOT NULL DEFAULT 0,
  display_vat_amount NUMERIC NOT NULL DEFAULT 0,
  calculation_source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add unique constraint to ensure one record per order
ALTER TABLE public.order_final_totals ADD CONSTRAINT unique_order_final_total UNIQUE (order_id);

-- Add indexes for performance
CREATE INDEX idx_order_final_totals_order_id ON public.order_final_totals(order_id);
CREATE INDEX idx_order_final_totals_created_at ON public.order_final_totals(created_at);

-- Enable RLS
ALTER TABLE public.order_final_totals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can manage order final totals" 
ON public.order_final_totals 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]));

CREATE POLICY "Clients can view their order final totals" 
ON public.order_final_totals 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.clients c ON c.id = o.client_id
  JOIN public.profiles p ON p.email = c.email
  WHERE o.id = order_final_totals.order_id 
  AND p.user_id = auth.uid()
));

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_order_final_totals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_final_totals_updated_at
  BEFORE UPDATE ON public.order_final_totals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_final_totals_updated_at();