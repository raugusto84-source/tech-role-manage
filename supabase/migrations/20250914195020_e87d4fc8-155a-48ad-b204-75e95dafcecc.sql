-- Add a lock to preserve quote pricing when converting to orders
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS pricing_locked boolean NOT NULL DEFAULT false;

-- Update trigger function to respect the lock
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
  -- If pricing is locked, skip recalculation
  IF NEW.pricing_locked IS TRUE THEN
    RETURN NEW;
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

-- Ensure trigger still exists (idempotent)
DROP TRIGGER IF EXISTS trigger_apply_policy_discounts ON public.order_items;
CREATE TRIGGER trigger_apply_policy_discounts
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_policy_discounts_to_order();

-- Update conversion function to lock pricing copied from quote
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(quote_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  quote_record RECORD;
  client_record RECORD;
  order_record RECORD;
  service_type_record RECORD;
  order_total NUMERIC := 0;
  new_estimated_delivery TIMESTAMP WITH TIME ZONE;
BEGIN
  IF get_user_role_safe() NOT IN ('administrador', 'vendedor') THEN
    RETURN json_build_object('error', 'No tiene permisos para crear órdenes');
  END IF;

  SELECT * INTO quote_record
  FROM public.quotes 
  WHERE id = quote_id AND status = 'aceptada';
  
  IF quote_record.id IS NULL THEN
    RETURN json_build_object('error', 'Cotización no encontrada o no está aceptada');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.orders o 
    JOIN public.clients c ON c.id = o.client_id 
    WHERE c.email = quote_record.client_email 
    AND o.created_at > quote_record.final_decision_date
  ) THEN
    RETURN json_build_object('error', 'Ya existe una orden para esta cotización');
  END IF;
  
  SELECT * INTO client_record
  FROM public.clients 
  WHERE email = quote_record.client_email
  LIMIT 1;
  
  IF client_record.id IS NULL THEN
    INSERT INTO public.clients (name, email, phone, address, created_by)
    VALUES (
      quote_record.client_name,
      quote_record.client_email,
      COALESCE(quote_record.client_phone, ''),
      'Dirección no especificada',
      quote_record.assigned_to
    ) RETURNING * INTO client_record;
  END IF;
  
  SELECT id INTO service_type_record
  FROM public.service_types 
  WHERE is_active = true 
  LIMIT 1;
  
  INSERT INTO public.orders (
    client_id,
    service_type,
    failure_description,
    estimated_cost,
    delivery_date,
    created_by,
    assigned_technician,
    status,
    client_approval
  ) VALUES (
    client_record.id,
    service_type_record.id,
    quote_record.service_description,
    quote_record.estimated_amount,
    CURRENT_DATE + INTERVAL '7 days',
    quote_record.assigned_to,
    NULL,
    'pendiente_aprobacion'::order_status,
    NULL
  ) RETURNING * INTO order_record;
  
  SELECT COALESCE(SUM(total), 0) INTO order_total
  FROM public.quote_items 
  WHERE quote_id = quote_record.id;
  
  INSERT INTO public.order_items (
    order_id,
    service_type_id,
    service_name,
    service_description,
    quantity,
    unit_cost_price,
    unit_base_price,
    profit_margin_rate,
    subtotal,
    vat_rate,
    vat_amount,
    total_amount,
    item_type,
    status,
    estimated_hours,
    shared_time,
    pricing_locked
  ) 
  SELECT 
    order_record.id,
    qi.service_type_id,
    qi.name,
    qi.description,
    qi.quantity,
    CASE 
      WHEN qi.vat_rate > 0 THEN qi.unit_price / (1 + qi.vat_rate / 100.0)
      ELSE qi.unit_price
    END as unit_cost_price,
    CASE 
      WHEN qi.vat_rate > 0 THEN qi.unit_price / (1 + qi.vat_rate / 100.0)
      ELSE qi.unit_price
    END as unit_base_price,
    0,
    qi.subtotal,
    qi.vat_rate,
    qi.vat_amount,
    qi.total,
    CASE WHEN qi.is_custom THEN 'articulo' ELSE 'servicio' END,
    'pendiente'::order_status,
    COALESCE((SELECT st.estimated_hours FROM service_types st WHERE st.id = qi.service_type_id), 4) * qi.quantity,
    false,
    true -- lock pricing to preserve quote totals
  FROM public.quote_items qi
  WHERE qi.quote_id = quote_record.id;
  
  new_estimated_delivery := public.calculate_estimated_delivery_time(order_record.id);
  
  UPDATE public.orders 
  SET 
    estimated_cost = order_total,
    estimated_delivery_date = new_estimated_delivery,
    delivery_date = new_estimated_delivery::date
  WHERE id = order_record.id;
  
  RETURN json_build_object(
    'success', true,
    'order_id', order_record.id,
    'order_number', order_record.order_number,
    'total_amount', order_total,
    'estimated_delivery_date', new_estimated_delivery
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$function$;