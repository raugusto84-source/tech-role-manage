
-- Change controlled_exit from boolean to integer (quantity)
ALTER TABLE public.access_development_leads 
  DROP COLUMN IF EXISTS controlled_exit;
ALTER TABLE public.access_development_leads 
  ADD COLUMN controlled_exits integer DEFAULT 0;

-- Add recovery_payments (internal, not shown to client)
ALTER TABLE public.access_development_leads 
  ADD COLUMN IF NOT EXISTS recovery_payments integer DEFAULT 0;

-- Add system_base_cost config if not exists
INSERT INTO public.access_quote_config (config_key, config_value, label, description, display_order)
VALUES ('system_base_cost', 0, 'Costo Base del Sistema', 'Costo fijo base del sistema independiente de las casas (gastos operativos)', 1)
ON CONFLICT (config_key) DO NOTHING;

-- Update display_order for existing items to make room
UPDATE public.access_quote_config SET display_order = display_order + 1 WHERE config_key != 'system_base_cost' AND display_order >= 1;
