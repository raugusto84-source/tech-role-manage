-- 2) Bundle creation function: creates scheduled service + items + immediate order + pending income
CREATE OR REPLACE FUNCTION public.create_scheduled_service_bundle(
  p_policy_client_id uuid,
  p_frequency_days integer,
  p_next_service_date date,
  p_service_description text,
  p_priority integer,
  p_created_by uuid,
  p_items jsonb
)
RETURNS TABLE(scheduled_service_id uuid, order_id uuid) AS $$
DECLARE
  new_sched_id uuid;
  item jsonb;
  s_item RECORD;
  client_data RECORD;
  service_rec RECORD;
  order_rec RECORD;
  order_no text;
  attempt int;
  subtotal_sum numeric := 0;
  vat_sum numeric := 0;
  total_sum numeric := 0;
  pricing RECORD;
  first_service uuid := NULL;
  policy_name text;
BEGIN
  -- Validate inputs
  IF p_policy_client_id IS NULL OR p_frequency_days IS NULL OR p_next_service_date IS NULL THEN
    RAISE EXCEPTION 'Parámetros requeridos faltantes';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un servicio en p_items';
  END IF;

  -- Get client + policy info
  SELECT c.id AS client_id, c.name AS client_name, c.email AS client_email, ip.policy_name AS pol_name
  INTO client_data
  FROM public.policy_clients pc
  JOIN public.clients c ON c.id = pc.client_id
  JOIN public.insurance_policies ip ON ip.id = pc.policy_id
  WHERE pc.id = p_policy_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente/póliza inválidos';
  END IF;
  policy_name := client_data.pol_name;

  -- Extract first service id for UI compatibility
  first_service := ((p_items->0)->>'service_type_id')::uuid;

  -- Create scheduled service parent disabled to bypass insert trigger
  INSERT INTO public.scheduled_services (
    policy_client_id, service_type_id, quantity, frequency_days, next_service_date,
    service_description, priority, created_by, is_active
  ) VALUES (
    p_policy_client_id, first_service, 1, p_frequency_days, p_next_service_date,
    p_service_description, p_priority, p_created_by, false
  ) RETURNING id INTO new_sched_id;

  -- Insert child items
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.scheduled_service_items (scheduled_service_id, service_type_id, quantity)
    VALUES (new_sched_id, (item->>'service_type_id')::uuid, GREATEST(((item->>'quantity')::int),1));
  END LOOP;

  -- Create order with all items and calculated pricing
  attempt := 0;
  FOR attempt IN 1..5 LOOP
    BEGIN
      order_no := public.generate_order_number();
      INSERT INTO public.orders (
        order_number, client_id, service_type, service_location, delivery_date, estimated_cost,
        failure_description, status, is_policy_order, order_priority, created_by, policy_name
      ) VALUES (
        order_no, client_data.client_id, NULL, jsonb_build_object('type','domicilio'), p_next_service_date, 0,
        COALESCE(p_service_description, 'Servicio programado bundle '|| new_sched_id::text), 'pendiente', true, p_priority, p_created_by, policy_name
      ) RETURNING * INTO order_rec;
      EXIT;
    EXCEPTION WHEN unique_violation THEN CONTINUE; END;
  END LOOP;
  IF order_rec.id IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar número de orden único';
  END IF;

  -- Loop items and compute pricing using existing function
  FOR s_item IN 
    SELECT ssi.service_type_id, ssi.quantity, st.name, st.description, st.item_type, st.vat_rate
    FROM public.scheduled_service_items ssi
    JOIN public.service_types st ON st.id = ssi.service_type_id
    WHERE ssi.scheduled_service_id = new_sched_id
  LOOP
    SELECT * INTO pricing FROM public.calculate_order_item_pricing(s_item.service_type_id, s_item.quantity);
    subtotal_sum := subtotal_sum + COALESCE(pricing.subtotal, 0);
    vat_sum := vat_sum + COALESCE(pricing.vat_amount, 0);
    total_sum := total_sum + COALESCE(pricing.total_amount, 0);

    INSERT INTO public.order_items (
      order_id, service_type_id, quantity, unit_cost_price, unit_base_price, profit_margin_rate,
      subtotal, vat_rate, vat_amount, total_amount, service_name, service_description, item_type, status, policy_name
    ) VALUES (
      order_rec.id, s_item.service_type_id, s_item.quantity,
      COALESCE(pricing.unit_cost_price,0), COALESCE(pricing.unit_base_price,0), COALESCE(pricing.profit_margin_rate,0),
      COALESCE(pricing.subtotal,0), COALESCE(pricing.vat_rate,0), COALESCE(pricing.vat_amount,0), COALESCE(pricing.total_amount,0),
      s_item.name, s_item.description, COALESCE(pricing.item_type, 'servicio'), 'pendiente', policy_name
    );
  END LOOP;

  -- Update order estimated cost to total
  UPDATE public.orders SET estimated_cost = total_sum WHERE id = order_rec.id;

  -- Create pending income record for finance
  INSERT INTO public.incomes (
    amount, description, category, account_type, income_date, status, income_number, client_name
  ) VALUES (
    total_sum,
    'Ingreso pendiente - Servicio programado '|| order_rec.order_number || ' ('|| policy_name ||')',
    'servicio_programado',
    'no_fiscal',
    CURRENT_DATE,
    'pendiente',
    '',
    client_data.client_name
  );

  -- Activate schedule and leave next date as provided (first already created)
  UPDATE public.scheduled_services
  SET is_active = true,
      last_service_date = p_next_service_date,
      next_service_date = p_next_service_date + (p_frequency_days || ' days')::interval
  WHERE id = new_sched_id;

  scheduled_service_id := new_sched_id;
  order_id := order_rec.id;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 3) Function to create order for an existing scheduled service (for manual button)
CREATE OR REPLACE FUNCTION public.create_order_for_scheduled_service(p_scheduled_service_id uuid)
RETURNS TABLE(order_id uuid, order_number text) AS $$
DECLARE
  svc RECORD;
BEGIN
  SELECT * INTO svc FROM public.scheduled_services WHERE id = p_scheduled_service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Servicio programado no encontrado'; END IF;
  RETURN QUERY
  SELECT (r).order_id, (SELECT order_number FROM public.orders WHERE id=(r).order_id)
  FROM (
    SELECT (public.create_scheduled_service_bundle(
      svc.policy_client_id,
      svc.frequency_days,
      svc.next_service_date,
      svc.service_description,
      svc.priority,
      svc.created_by,
      (
        SELECT jsonb_agg(jsonb_build_object('service_type_id', ssi.service_type_id, 'quantity', ssi.quantity))
        FROM public.scheduled_service_items ssi WHERE ssi.scheduled_service_id = svc.id
      )
    )).order_id as order_id
  ) r;

  -- Update next date forward since we just created one now
  UPDATE public.scheduled_services
  SET last_service_date = CURRENT_DATE,
      next_service_date = CURRENT_DATE + (svc.frequency_days || ' days')::interval
  WHERE id = p_scheduled_service_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';