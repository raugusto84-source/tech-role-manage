-- Create vehicles table if not exists
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  year INTEGER,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo', 'mantenimiento')),
  current_mileage INTEGER DEFAULT 0,
  purchase_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicles
CREATE POLICY "Staff can manage vehicles" ON public.vehicles
  FOR ALL USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Staff can view vehicles" ON public.vehicles
  FOR SELECT USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text]));

-- Create updated_at trigger for vehicles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();