-- Crear tabla para items de órdenes con precios fijos
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id),
  service_name TEXT NOT NULL,
  service_description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost_price NUMERIC(10,2) NOT NULL,
  unit_base_price NUMERIC(10,2) NOT NULL,
  profit_margin_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'servicio' CHECK (item_type IN ('servicio', 'articulo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for order items
CREATE POLICY "Users can view order items for their orders" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    LEFT JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_items.order_id 
    AND (
      o.assigned_technician = auth.uid() 
      OR p.role = 'administrador'::user_role 
      OR (p.role = 'cliente'::user_role AND c.email = p.email)
      OR p.role = 'vendedor'::user_role
    )
  )
);

CREATE POLICY "Staff can manage order items" 
ON public.order_items 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['administrador'::user_role, 'vendedor'::user_role])
  )
);

-- Create function to calculate prices with taxes
CREATE OR REPLACE FUNCTION public.calculate_order_item_pricing(
  p_service_type_id UUID,
  p_quantity INTEGER DEFAULT 1
) RETURNS TABLE(
  unit_cost_price NUMERIC,
  unit_base_price NUMERIC,
  profit_margin_rate NUMERIC,
  subtotal NUMERIC,
  vat_rate NUMERIC,
  vat_amount NUMERIC,
  total_amount NUMERIC,
  item_type TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  service_data RECORD;
  applicable_margin NUMERIC;
  tier_data JSONB;
BEGIN
  -- Get service type data
  SELECT s.cost_price, s.base_price, s.vat_rate, s.profit_margin_tiers, s.item_type
  INTO service_data
  FROM public.service_types s
  WHERE s.id = p_service_type_id AND s.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado o inactivo';
  END IF;
  
  -- Set default values
  item_type := COALESCE(service_data.item_type, 'servicio');
  vat_rate := COALESCE(service_data.vat_rate, 0);
  
  IF item_type = 'servicio' THEN
    -- SERVICIOS: Fixed price established (base_price)
    unit_base_price := COALESCE(service_data.base_price, 0);
    unit_cost_price := unit_base_price;
    profit_margin_rate := 0; -- No margin calculation, included in fixed price
    subtotal := unit_base_price * p_quantity;
    vat_amount := (subtotal * vat_rate / 100);
    total_amount := subtotal + vat_amount;
  ELSE
    -- ARTICLES: Base cost + margin + VAT
    unit_cost_price := COALESCE(service_data.cost_price, 0);
    applicable_margin := 30.0; -- default margin
    
    -- Calculate applicable margin based on quantity tiers
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
    
    profit_margin_rate := applicable_margin;
    unit_base_price := unit_cost_price + (unit_cost_price * applicable_margin / 100);
    subtotal := unit_base_price * p_quantity;
    vat_amount := (subtotal * vat_rate / 100);
    total_amount := subtotal + vat_amount;
  END IF;
  
  RETURN NEXT;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_order_items_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_service_type_id ON public.order_items(service_type_id);