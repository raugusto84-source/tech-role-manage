-- Agregar campo para diferenciar artículos vs servicios
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'servicio' CHECK (item_type IN ('servicio', 'articulo'));

-- Actualizar función de cálculo para manejar ambos tipos
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
  base_amount numeric;
BEGIN
  -- Obtener datos del servicio
  SELECT s.cost_price, s.base_price, s.vat_rate, s.profit_margin_tiers, s.item_type
  INTO service_data
  FROM public.service_types s
  WHERE s.id = p_service_id AND s.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado o inactivo';
  END IF;
  
  IF service_data.item_type = 'servicio' THEN
    -- SERVICIOS: Precio fijo establecido (base_price)
    base_amount := service_data.base_price;
    cost_price := base_amount * p_quantity;
    profit_margin := 0; -- No se calcula margen, está incluido en el precio fijo
    vat_amount := (base_amount * service_data.vat_rate / 100) * p_quantity;
    final_price := cost_price + vat_amount;
    unit_price := base_amount + (base_amount * service_data.vat_rate / 100);
  ELSE
    -- ARTÍCULOS: Costo base + margen + IVA
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
    
    cost_price := service_data.cost_price * p_quantity;
    profit_margin := (service_data.cost_price * applicable_margin / 100) * p_quantity;
    vat_amount := ((service_data.cost_price + (service_data.cost_price * applicable_margin / 100)) * service_data.vat_rate / 100) * p_quantity;
    final_price := cost_price + profit_margin + vat_amount;
    unit_price := (service_data.cost_price + (service_data.cost_price * applicable_margin / 100) + ((service_data.cost_price + (service_data.cost_price * applicable_margin / 100)) * service_data.vat_rate / 100));
  END IF;
  
  RETURN NEXT;
END;
$$;