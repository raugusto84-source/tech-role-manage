-- Create fleet_assignments table to link technicians to fleet groups
CREATE TABLE public.fleet_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fleet_group_id UUID NOT NULL REFERENCES public.fleet_groups(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(user_id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate assignments
CREATE UNIQUE INDEX idx_fleet_assignments_unique 
ON public.fleet_assignments (fleet_group_id, technician_id) 
WHERE is_active = true;

-- Create index for faster queries
CREATE INDEX idx_fleet_assignments_technician 
ON public.fleet_assignments (technician_id);

CREATE INDEX idx_fleet_assignments_fleet_group 
ON public.fleet_assignments (fleet_group_id);

-- Enable RLS
ALTER TABLE public.fleet_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage fleet assignments" 
ON public.fleet_assignments 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view fleet assignments" 
ON public.fleet_assignments 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico']));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_fleet_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fleet_assignments_updated_at
BEFORE UPDATE ON public.fleet_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_fleet_assignments_updated_at();