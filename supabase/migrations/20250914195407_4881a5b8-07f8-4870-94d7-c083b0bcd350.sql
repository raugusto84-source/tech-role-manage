-- Restrict recalculation trigger to real pricing changes only
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
  -- Respect locked pricing (copied from quote)
  IF NEW.pricing_locked IS TRUE THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only recalc when pricing-relevant fields changed
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.quantity IS NOT DISTINCT FROM OLD.quantity)
       AND (NEW.service_type_id IS NOT DISTINCT FROM OLD.service_type_id) THEN
      RETURN NEW; -- skip recalculation for status/notes/other updates
    END IF;
  END IF;

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

-- Ensure trigger is still attached
DROP TRIGGER IF EXISTS trigger_apply_policy_discounts ON public.order_items;
CREATE TRIGGER trigger_apply_policy_discounts
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_policy_discounts_to_order();