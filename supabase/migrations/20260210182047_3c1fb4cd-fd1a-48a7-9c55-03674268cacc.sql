
-- Table for admin-configurable pricing parameters
CREATE TABLE public.access_quote_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value NUMERIC NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE public.access_quote_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read config" ON public.access_quote_config FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update config" ON public.access_quote_config FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert config" ON public.access_quote_config FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default pricing configuration
INSERT INTO public.access_quote_config (config_key, config_value, label, description, display_order) VALUES
  ('vehicular_gate_single_cost', 1500, 'Costo por acceso vehicular (1 hoja)', 'Costo mensual por cada acceso vehicular de una hoja', 1),
  ('vehicular_gate_double_cost', 2000, 'Costo por acceso vehicular (2 hojas)', 'Costo mensual por cada acceso vehicular de dos hojas', 2),
  ('pedestrian_door_cost', 800, 'Costo por puerta peatonal', 'Costo mensual por cada puerta peatonal', 3),
  ('controlled_exit_surcharge', 500, 'Cargo adicional salida controlada', 'Cargo mensual adicional si la salida es controlada', 4),
  ('per_house_base_cost', 50, 'Costo base por casa', 'Costo mensual base por cada casa del fraccionamiento', 5),
  ('discount_18_months', 0, 'Descuento 18 meses (%)', 'Porcentaje de descuento para contrato de 18 meses', 10),
  ('discount_24_months', 3, 'Descuento 2 años (%)', 'Porcentaje de descuento para contrato de 2 años', 11),
  ('discount_36_months', 7, 'Descuento 3 años (%)', 'Porcentaje de descuento para contrato de 3 años', 12),
  ('implementation_fee_months', 1, 'Meses de implementación', 'Cantidad de mensualidades como pago inicial de implementación', 20);

-- Add quote calculation fields to leads table
ALTER TABLE public.access_development_leads
  ADD COLUMN IF NOT EXISTS vehicular_gates_single INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vehicular_gates_double INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedestrian_doors INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS controlled_exit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS num_houses INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_months INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS quote_breakdown JSONB;
