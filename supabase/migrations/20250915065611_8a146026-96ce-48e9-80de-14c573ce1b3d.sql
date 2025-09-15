-- Fix pending_collections to calculate correct totals for products with double VAT
-- Update function to recalculate totals properly for products and services

CREATE OR REPLACE FUNCTION public.manage_pending_collections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_record RECORD;
  calculated_total NUMERIC := 0;
  cashback_percent NUMERIC := 0;
  apply_cashback BOOLEAN := false;
  cashback_factor NUMERIC := 1;
  final_total NUMERIC := 0;
  client_info RECORD;
BEGIN
  -- Load reward settings (if any)
  SELECT COALESCE(rs.general_cashback_percent, 0), COALESCE(rs.apply_cashback_to_items, false)
  INTO cashback_percent, apply_cashback
  FROM public.reward_settings rs
  WHERE rs.is_active = true
  ORDER BY rs.created_at DESC
  LIMIT 1;

  cashback_factor := CASE WHEN apply_cashback THEN 1 + (cashback_percent / 100.0) ELSE 1 END;

  IF TG_OP = 'UPDATE' THEN
    -- Calculate total by iterating through each item and applying correct pricing logic
    FOR item_record IN 
      SELECT oi.*, st.cost_price, st.base_price, st.item_type, st.profit_margin_tiers
      FROM public.order_items oi
      LEFT JOIN public.service_types st ON st.id = oi.service_type_id
      WHERE oi.order_id = NEW.id
    LOOP
      DECLARE
        item_total NUMERIC := 0;
        base_cost NUMERIC := 0;
        margin_rate NUMERIC := 30;
        vat_rate NUMERIC := 16;
      BEGIN
        IF item_record.item_type = 'servicio' THEN
          -- Services: base_price + VAT
          base_cost := COALESCE(item_record.base_price, item_record.unit_base_price, 0) * item_record.quantity;
          item_total := base_cost * (1 + vat_rate / 100.0);
        ELSE
          -- Products: cost + purchase VAT + margin + sales VAT
          base_cost := COALESCE(item_record.cost_price, item_record.unit_cost_price, 0) * item_record.quantity;
          
          -- Get margin from profit_margin_rate field or default
          margin_rate := COALESCE(item_record.profit_margin_rate, 30);
          
          -- Apply purchase VAT (16%)
          base_cost := base_cost * (1 + 16.0 / 100.0);
          -- Apply margin
          base_cost := base_cost * (1 + margin_rate / 100.0);
          -- Apply sales VAT (16%)
          item_total := base_cost * (1 + vat_rate / 100.0);
        END IF;
        
        -- Apply cashback and add to total
        calculated_total := calculated_total + (item_total * cashback_factor);
      END;
    END LOOP;

    -- Round up to nearest 10
    final_total := CEIL(calculated_total / 10.0) * 10.0;

    -- Fallback to estimated_cost if no items yet
    IF final_total = 0 AND NEW.estimated_cost > 0 THEN
      final_total := CEIL((NEW.estimated_cost * cashback_factor) / 10.0) * 10.0;
    END IF;

    -- If authorization just changed to true, create/update collection
    IF NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM NEW.client_approval THEN
      SELECT c.name, c.email INTO client_info
      FROM public.clients c
      WHERE c.id = NEW.client_id;

      INSERT INTO public.pending_collections (
        order_id,
        order_number,
        client_name,
        client_email,
        amount,
        balance,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.order_number,
        COALESCE(client_info.name, 'Cliente'),
        COALESCE(client_info.email, ''),
        final_total,
        final_total,
        now(),
        now()
      )
      ON CONFLICT (order_id)
      DO UPDATE SET
        order_number = EXCLUDED.order_number,
        client_name = EXCLUDED.client_name,
        client_email = EXCLUDED.client_email,
        amount = EXCLUDED.amount,
        balance = EXCLUDED.balance,
        updated_at = now();

    ELSIF NEW.client_approval = true THEN
      -- Keep totals in sync if order changes after authorization
      UPDATE public.pending_collections
      SET amount = final_total,
          balance = CASE WHEN balance > final_total THEN final_total ELSE balance END,
          updated_at = now()
      WHERE order_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_pending_collections_on_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_id_val UUID;
  item_record RECORD;
  calculated_total NUMERIC := 0;
  cashback_percent NUMERIC := 0;
  apply_cashback BOOLEAN := false;
  cashback_factor NUMERIC := 1;
  final_total NUMERIC := 0;
  order_is_authorized BOOLEAN := false;
BEGIN
  order_id_val := COALESCE(NEW.order_id, OLD.order_id);

  -- Load reward settings
  SELECT COALESCE(rs.general_cashback_percent, 0), COALESCE(rs.apply_cashback_to_items, false)
  INTO cashback_percent, apply_cashback
  FROM public.reward_settings rs
  WHERE rs.is_active = true
  ORDER BY rs.created_at DESC
  LIMIT 1;

  cashback_factor := CASE WHEN apply_cashback THEN 1 + (cashback_percent / 100.0) ELSE 1 END;

  -- Calculate total by iterating through each item and applying correct pricing logic
  FOR item_record IN 
    SELECT oi.*, st.cost_price, st.base_price, st.item_type, st.profit_margin_tiers
    FROM public.order_items oi
    LEFT JOIN public.service_types st ON st.id = oi.service_type_id
    WHERE oi.order_id = order_id_val
  LOOP
    DECLARE
      item_total NUMERIC := 0;
      base_cost NUMERIC := 0;
      margin_rate NUMERIC := 30;
      vat_rate NUMERIC := 16;
    BEGIN
      IF item_record.item_type = 'servicio' THEN
        -- Services: base_price + VAT
        base_cost := COALESCE(item_record.base_price, item_record.unit_base_price, 0) * item_record.quantity;
        item_total := base_cost * (1 + vat_rate / 100.0);
      ELSE
        -- Products: cost + purchase VAT + margin + sales VAT
        base_cost := COALESCE(item_record.cost_price, item_record.unit_cost_price, 0) * item_record.quantity;
        
        -- Get margin from profit_margin_rate field or default
        margin_rate := COALESCE(item_record.profit_margin_rate, 30);
        
        -- Apply purchase VAT (16%)
        base_cost := base_cost * (1 + 16.0 / 100.0);
        -- Apply margin
        base_cost := base_cost * (1 + margin_rate / 100.0);
        -- Apply sales VAT (16%)
        item_total := base_cost * (1 + vat_rate / 100.0);
      END IF;
      
      -- Apply cashback and add to total
      calculated_total := calculated_total + (item_total * cashback_factor);
    END;
  END LOOP;

  -- Round up to nearest 10
  final_total := CEIL(calculated_total / 10.0) * 10.0;

  -- Only update if order is authorized
  SELECT COALESCE(o.client_approval, false) INTO order_is_authorized
  FROM public.orders o
  WHERE o.id = order_id_val;

  IF order_is_authorized AND final_total > 0 THEN
    UPDATE public.pending_collections
    SET amount = final_total,
        balance = CASE WHEN balance > final_total THEN final_total ELSE balance END,
        updated_at = now()
    WHERE order_id = order_id_val;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;