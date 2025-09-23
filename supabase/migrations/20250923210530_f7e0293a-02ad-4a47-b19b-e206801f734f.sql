-- Create table for automatic services in policies
CREATE TABLE public.policy_service_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_client_id UUID NOT NULL REFERENCES public.policy_clients(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  frequency_days INTEGER NOT NULL DEFAULT 30, -- Days between automatic orders
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(policy_client_id, service_type_id)
);

-- Enable RLS
ALTER TABLE public.policy_service_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage policy service configurations"
ON public.policy_service_configurations
FOR ALL
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view policy service configurations"
ON public.policy_service_configurations
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'vendedor', 'tecnico']));

-- Add trigger for updated_at
CREATE TRIGGER update_policy_service_configurations_updated_at
BEFORE UPDATE ON public.policy_service_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();