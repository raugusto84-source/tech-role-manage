-- Create function to calculate order pricing with policy discounts
CREATE OR REPLACE FUNCTION public.calculate_order_pricing_with_policy(
  p_client_id uuid,
  p_service_type_id uuid, 
  p_quantity integer DEFAULT 1
)
RETURNS TABLE(
  unit_cost_price numeric,
  unit_base_price numeric, 
  profit_margin_rate numeric,
  subtotal numeric,
  policy_discount_percentage numeric,
  policy_discount_amount numeric,
  final_subtotal numeric,
  vat_rate numeric,
  vat_amount numeric,
  total_amount numeric,
  item_type text,
  is_policy_client boolean,
  policy_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_data RECORD;
  policy_data RECORD;
  base_pricing RECORD;
BEGIN
  -- Get service type data
  SELECT s.cost_price, s.base_price, s.vat_rate, s.profit_margin_tiers, s.item_type
  INTO service_data
  FROM public.service_types s
  WHERE s.id = p_service_type_id AND s.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado o inactivo';
  END IF;

  -- Check if client has active policy
  SELECT 
    ip.policy_name,
    ip.service_discount_percentage,
    ip.free_services,
    pc.id as policy_client_id
  INTO policy_data
  FROM public.policy_clients pc
  JOIN public.insurance_policies ip ON ip.id = pc.policy_id
  WHERE pc.client_id = p_client_id 
    AND pc.is_active = true 
    AND ip.is_active = true
  LIMIT 1;

  -- Get base pricing from existing function
  SELECT * INTO base_pricing
  FROM public.calculate_order_item_pricing(p_service_type_id, p_quantity);

  -- Set base values
  unit_cost_price := base_pricing.unit_cost_price;
  unit_base_price := base_pricing.unit_base_price;
  profit_margin_rate := base_pricing.profit_margin_rate;
  subtotal := base_pricing.subtotal;
  vat_rate := base_pricing.vat_rate;
  item_type := base_pricing.item_type;

  -- Apply policy discount if client has policy and item is a service
  IF policy_data.policy_client_id IS NOT NULL AND item_type = 'servicio' THEN
    is_policy_client := true;
    policy_name := policy_data.policy_name;
    
    -- Apply discount based on policy configuration
    IF policy_data.free_services THEN
      -- Services are completely free
      policy_discount_percentage := 100;
      policy_discount_amount := subtotal;
      final_subtotal := 0;
    ELSE
      -- Apply percentage discount
      policy_discount_percentage := COALESCE(policy_data.service_discount_percentage, 0);
      policy_discount_amount := subtotal * (policy_discount_percentage / 100);
      final_subtotal := subtotal - policy_discount_amount;
    END IF;
  ELSE
    -- No policy or not a service
    is_policy_client := COALESCE(policy_data.policy_client_id IS NOT NULL, false);
    policy_name := policy_data.policy_name;
    policy_discount_percentage := 0;
    policy_discount_amount := 0;
    final_subtotal := subtotal;
  END IF;

  -- Calculate VAT on final subtotal
  vat_amount := (final_subtotal * vat_rate / 100);
  total_amount := final_subtotal + vat_amount;

  RETURN NEXT;
END;
$$;

-- Create trigger to update order items with policy discounts
CREATE OR REPLACE FUNCTION public.apply_policy_discounts_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_id_val uuid;
  pricing_data RECORD;
BEGIN
  -- Get client_id from order
  SELECT client_id INTO client_id_val
  FROM public.orders
  WHERE id = NEW.order_id;

  -- Calculate pricing with policy discounts
  SELECT * INTO pricing_data
  FROM public.calculate_order_pricing_with_policy(
    client_id_val, 
    NEW.service_type_id, 
    NEW.quantity
  );

  -- Update the order item with policy-adjusted pricing
  IF pricing_data.is_policy_client AND NEW.item_type = 'servicio' THEN
    NEW.unit_cost_price := pricing_data.unit_cost_price;
    NEW.unit_base_price := pricing_data.unit_base_price;
    NEW.profit_margin_rate := pricing_data.profit_margin_rate;
    NEW.subtotal := pricing_data.subtotal;
    NEW.vat_rate := pricing_data.vat_rate;
    NEW.vat_amount := pricing_data.vat_amount;
    NEW.total_amount := pricing_data.total_amount;
    
    -- Store policy discount information in a JSON field if it doesn't exist
    -- We'll need to add this field to order_items table
  END IF;

  RETURN NEW;
END;
$$;

-- Add policy discount fields to order_items table
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS policy_discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS policy_discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_subtotal numeric,
ADD COLUMN IF NOT EXISTS policy_name text;

-- Update the trigger function to include policy discount fields
CREATE OR REPLACE FUNCTION public.apply_policy_discounts_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_id_val uuid;
  pricing_data RECORD;
BEGIN
  -- Get client_id from order
  SELECT client_id INTO client_id_val
  FROM public.orders
  WHERE id = NEW.order_id;

  -- Calculate pricing with policy discounts
  SELECT * INTO pricing_data
  FROM public.calculate_order_pricing_with_policy(
    client_id_val, 
    NEW.service_type_id, 
    NEW.quantity
  );

  -- Update the order item with policy-adjusted pricing
  NEW.unit_cost_price := pricing_data.unit_cost_price;
  NEW.unit_base_price := pricing_data.unit_base_price;
  NEW.profit_margin_rate := pricing_data.profit_margin_rate;
  NEW.original_subtotal := pricing_data.subtotal;
  NEW.policy_discount_percentage := pricing_data.policy_discount_percentage;
  NEW.policy_discount_amount := pricing_data.policy_discount_amount;
  NEW.subtotal := pricing_data.final_subtotal;
  NEW.vat_rate := pricing_data.vat_rate;
  NEW.vat_amount := pricing_data.vat_amount;
  NEW.total_amount := pricing_data.total_amount;
  NEW.policy_name := pricing_data.policy_name;

  RETURN NEW;
END;
$$;

-- Create trigger for order items
DROP TRIGGER IF EXISTS trigger_apply_policy_discounts ON public.order_items;
CREATE TRIGGER trigger_apply_policy_discounts
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_policy_discounts_to_order();

-- Update orders to show policy information
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS has_policy_discount boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS policy_name text;