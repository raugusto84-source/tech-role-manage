-- Create policy_equipment table to store equipment associated with policy contracts
CREATE TABLE IF NOT EXISTS public.policy_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_client_id UUID NOT NULL REFERENCES public.policy_clients(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.equipment_categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.equipment_brands(id) ON DELETE SET NULL,
  model_id UUID REFERENCES public.equipment_models(id) ON DELETE SET NULL,
  equipment_name TEXT NOT NULL,
  brand_name TEXT,
  model_name TEXT,
  serial_number TEXT,
  physical_condition TEXT,
  additional_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for policy_equipment
ALTER TABLE public.policy_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage policy equipment"
ON public.policy_equipment
FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]));

CREATE POLICY "Clients can view their policy equipment"
ON public.policy_equipment
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.policy_clients pc
    JOIN public.clients c ON c.id = pc.client_id
    JOIN public.profiles p ON p.email = c.email
    WHERE pc.id = policy_equipment.policy_client_id
    AND p.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_policy_equipment_updated_at
BEFORE UPDATE ON public.policy_equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_equipment_updated_at_column();

-- Add serviced_at column to order_equipment to track when equipment was serviced
ALTER TABLE public.order_equipment
ADD COLUMN IF NOT EXISTS serviced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS serviced_by UUID REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS policy_equipment_id UUID REFERENCES public.policy_equipment(id);

COMMENT ON COLUMN public.order_equipment.serviced_at IS 'Timestamp when this equipment was serviced in this order';
COMMENT ON COLUMN public.order_equipment.serviced_by IS 'User who marked this equipment as serviced';
COMMENT ON COLUMN public.order_equipment.policy_equipment_id IS 'Reference to policy equipment if this order came from a policy contract';