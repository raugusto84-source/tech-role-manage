-- Migración para sistema de precios de servicios con IVA y ganancia configurable

-- Agregar campos necesarios a service_types para gestión de precios
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_rate numeric DEFAULT 19.0,
ADD COLUMN IF NOT EXISTS profit_margin_tiers jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'unidad',
ADD COLUMN IF NOT EXISTS min_quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_quantity integer DEFAULT 999;

-- Crear comentarios para documentar la estructura
COMMENT ON COLUMN public.service_types.cost_price IS 'Precio de costo base del servicio/artículo';
COMMENT ON COLUMN public.service_types.vat_rate IS 'Porcentaje de IVA aplicable (ej: 19.0 para 19%)';
COMMENT ON COLUMN public.service_types.profit_margin_tiers IS 'Configuración de márgenes de ganancia por cantidad: [{"min_qty": 1, "max_qty": 10, "margin": 30}, {"min_qty": 11, "max_qty": 50, "margin": 25}]';
COMMENT ON COLUMN public.service_types.category IS 'Categoría del servicio/artículo';
COMMENT ON COLUMN public.service_types.unit IS 'Unidad de medida (unidad, hora, metro, etc.)';
COMMENT ON COLUMN public.service_types.min_quantity IS 'Cantidad mínima permitida';
COMMENT ON COLUMN public.service_types.max_quantity IS 'Cantidad máxima permitida';

-- Crear función para calcular precio final
CREATE OR REPLACE FUNCTION public.calculate_service_price(
  p_service_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS TABLE(
  cost_price numeric,
  profit_margin numeric,
  vat_amount numeric,
  final_price numeric,
  unit_price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_data RECORD;
  applicable_margin numeric;
  tier_data jsonb;
BEGIN
  -- Obtener datos del servicio
  SELECT s.cost_price, s.vat_rate, s.profit_margin_tiers
  INTO service_data
  FROM public.service_types s
  WHERE s.id = p_service_id AND s.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado o inactivo';
  END IF;
  
  -- Determinar margen de ganancia según cantidad
  applicable_margin := 30.0; -- default margin
  
  IF service_data.profit_margin_tiers IS NOT NULL THEN
    FOR tier_data IN SELECT * FROM jsonb_array_elements(service_data.profit_margin_tiers)
    LOOP
      IF p_quantity >= (tier_data->>'min_qty')::integer 
         AND p_quantity <= (tier_data->>'max_qty')::integer THEN
        applicable_margin := (tier_data->>'margin')::numeric;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- Calcular precios
  cost_price := service_data.cost_price * p_quantity;
  profit_margin := (service_data.cost_price * applicable_margin / 100) * p_quantity;
  vat_amount := ((service_data.cost_price + (service_data.cost_price * applicable_margin / 100)) * service_data.vat_rate / 100) * p_quantity;
  final_price := cost_price + profit_margin + vat_amount;
  unit_price := (service_data.cost_price + (service_data.cost_price * applicable_margin / 100) + ((service_data.cost_price + (service_data.cost_price * applicable_margin / 100)) * service_data.vat_rate / 100));
  
  RETURN NEXT;
END;
$$;

-- Actualizar datos existentes con valores por defecto
UPDATE public.service_types 
SET 
  cost_price = COALESCE(base_price, 0),
  profit_margin_tiers = '[{"min_qty": 1, "max_qty": 10, "margin": 30}, {"min_qty": 11, "max_qty": 50, "margin": 25}, {"min_qty": 51, "max_qty": 999, "margin": 20}]'::jsonb
WHERE cost_price IS NULL OR profit_margin_tiers IS NULL;