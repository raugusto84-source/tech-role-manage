-- Crear tabla para grupos de flotillas
CREATE TABLE public.fleet_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para asignar técnicos a grupos de flotillas
CREATE TABLE public.fleet_group_technicians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fleet_group_id UUID NOT NULL REFERENCES public.fleet_groups(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(fleet_group_id, technician_id)
);

-- Crear tabla para asignar vehículos a grupos de flotillas
CREATE TABLE public.fleet_group_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fleet_group_id UUID NOT NULL REFERENCES public.fleet_groups(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(fleet_group_id, vehicle_id)
);

-- Habilitar RLS en las tablas
ALTER TABLE public.fleet_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_group_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_group_vehicles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fleet_groups
CREATE POLICY "Admins can manage fleet groups" 
ON public.fleet_groups 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view fleet groups" 
ON public.fleet_groups 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'tecnico', 'vendedor']));

-- Políticas RLS para fleet_group_technicians
CREATE POLICY "Admins can manage fleet group technicians" 
ON public.fleet_group_technicians 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view fleet group technicians" 
ON public.fleet_group_technicians 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'tecnico', 'vendedor']));

-- Políticas RLS para fleet_group_vehicles
CREATE POLICY "Admins can manage fleet group vehicles" 
ON public.fleet_group_vehicles 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view fleet group vehicles" 
ON public.fleet_group_vehicles 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'tecnico', 'vendedor']));

-- Trigger para updated_at en fleet_groups
CREATE OR REPLACE FUNCTION public.update_fleet_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fleet_groups_updated_at
BEFORE UPDATE ON public.fleet_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_fleet_groups_updated_at();