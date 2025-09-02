-- Crear usuario administrador rmercado si no existe
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'rmercado@syslag.com',
  crypt('rmercado2025', gen_salt('bf')),
  now(),
  null,
  null,
  '{"provider":"email","providers":["email"]}',
  '{"username": "rmercado", "full_name": "Rafael Mercado", "role": "administrador"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO NOTHING;

-- Asegurar que el perfil existe para rmercado
INSERT INTO public.profiles (user_id, email, username, full_name, role)
SELECT 
  u.id,
  'rmercado@syslag.com',
  'rmercado',
  'Rafael Mercado',
  'administrador'::user_role
FROM auth.users u 
WHERE u.email = 'rmercado@syslag.com'
ON CONFLICT (user_id) DO UPDATE SET
  username = 'rmercado',
  full_name = 'Rafael Mercado',
  role = 'administrador'::user_role;

-- Actualizar función de cálculo de precios para incluir IVA del 16% en artículos
CREATE OR REPLACE FUNCTION public.calculate_order_item_pricing(p_service_type_id uuid, p_quantity integer DEFAULT 1)
RETURNS TABLE(unit_cost_price numeric, unit_base_price numeric, profit_margin_rate numeric, subtotal numeric, vat_rate numeric, vat_amount numeric, total_amount numeric, item_type text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_data RECORD;
  applicable_margin NUMERIC;
  tier_data JSONB;
  purchase_vat_rate NUMERIC := 16.0; -- IVA de compra del 16%
  sales_vat_rate NUMERIC := 16.0;    -- IVA de venta del 16%
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
  
  IF item_type = 'servicio' THEN
    -- SERVICIOS: Fixed price established (base_price) + IVA
    unit_cost_price := COALESCE(service_data.base_price, 0);
    unit_base_price := unit_cost_price;
    profit_margin_rate := 0; -- No margin calculation, included in fixed price
    subtotal := unit_base_price * p_quantity;
    vat_rate := sales_vat_rate; -- IVA de venta 16%
    vat_amount := (subtotal * vat_rate / 100);
    total_amount := subtotal + vat_amount;
  ELSE
    -- ARTICLES: (Costo + 16% IVA compra) + Margen + 16% IVA venta
    unit_cost_price := COALESCE(service_data.cost_price, 0);
    
    -- Aplicar IVA de compra al costo
    unit_cost_price := unit_cost_price + (unit_cost_price * purchase_vat_rate / 100);
    
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
    -- Aplicar margen sobre el costo con IVA de compra
    unit_base_price := unit_cost_price + (unit_cost_price * applicable_margin / 100);
    subtotal := unit_base_price * p_quantity;
    -- Aplicar IVA de venta del 16%
    vat_rate := sales_vat_rate;
    vat_amount := (subtotal * vat_rate / 100);
    total_amount := subtotal + vat_amount;
  END IF;
  
  RETURN NEXT;
END;
$$;