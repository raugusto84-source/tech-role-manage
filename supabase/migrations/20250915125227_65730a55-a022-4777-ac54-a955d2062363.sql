-- Create function to calculate and insert order final totals
CREATE OR REPLACE FUNCTION public.calculate_and_insert_order_final_totals()
RETURNS TRIGGER AS $$
DECLARE
  subtotal_amount NUMERIC := 0;
  vat_amount NUMERIC := 0;
  total_amount NUMERIC := 0;
  item_rec RECORD;
  rs RECORD;
  sales_vat_rate NUMERIC;
  qty NUMERIC;
  cashback_rate NUMERIC := 0;
  item_total_rounded NUMERIC;
  item_subtotal_calc NUMERIC;
  item_vat_calc NUMERIC;
BEGIN
  -- Get reward settings
  SELECT * INTO rs 
  FROM public.reward_settings 
  WHERE is_active = true 
  ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, created_at DESC 
  LIMIT 1;

  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  END IF;

  -- Calculate totals from order items
  FOR item_rec IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
    sales_vat_rate := CASE WHEN item_rec.vat_rate IS NULL THEN 16 ELSE item_rec.vat_rate END;
    qty := GREATEST(COALESCE(item_rec.quantity, 1), 1);

    IF item_rec.item_type = 'servicio' THEN
      -- Service calculation
      item_total_rounded := COALESCE(item_rec.unit_base_price, 0) * qty;
      item_total_rounded := item_total_rounded * (1 + sales_vat_rate / 100.0);
      item_total_rounded := item_total_rounded * (1 + cashback_rate / 100.0);
      item_total_rounded := CEIL(item_total_rounded / 10.0) * 10.0;
    ELSE
      -- Product calculation
      DECLARE
        base_cost NUMERIC := COALESCE(item_rec.unit_cost_price, 0) * qty;
        profit_margin NUMERIC := COALESCE(item_rec.profit_margin_rate, 30.0);
      BEGIN
        item_total_rounded := base_cost * 1.16;
        item_total_rounded := item_total_rounded * (1 + profit_margin / 100.0);
        item_total_rounded := item_total_rounded * (1 + sales_vat_rate / 100.0);
        item_total_rounded := item_total_rounded * (1 + cashback_rate / 100.0);
        item_total_rounded := CEIL(item_total_rounded / 10.0) * 10.0;
      END;
    END IF;

    -- Calculate subtotal and VAT from final amount
    item_subtotal_calc := item_total_rounded / (1 + sales_vat_rate / 100.0);
    item_vat_calc := item_total_rounded - item_subtotal_calc;

    subtotal_amount := subtotal_amount + item_subtotal_calc;
    vat_amount := vat_amount + item_vat_calc;
    total_amount := total_amount + item_total_rounded;
  END LOOP;

  -- If no items yet, use estimated_cost as fallback
  IF total_amount = 0 AND NEW.estimated_cost IS NOT NULL THEN
    total_amount := NEW.estimated_cost;
    subtotal_amount := total_amount / 1.16; -- Assuming 16% VAT
    vat_amount := total_amount - subtotal_amount;
  END IF;

  -- Insert into order_final_totals
  INSERT INTO public.order_final_totals (
    order_id,
    final_total_amount,
    display_subtotal,
    display_vat_amount,
    calculation_source,
    created_by
  ) VALUES (
    NEW.id,
    total_amount,
    subtotal_amount,
    vat_amount,
    'auto_trigger',
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run after order insert
CREATE TRIGGER trigger_insert_order_final_totals
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_and_insert_order_final_totals();

-- Create function to update order final totals when items change
CREATE OR REPLACE FUNCTION public.update_order_final_totals_on_items_change()
RETURNS TRIGGER AS $$
DECLARE
  target_order_id UUID;
  subtotal_amount NUMERIC := 0;
  vat_amount NUMERIC := 0;
  total_amount NUMERIC := 0;
  item_rec RECORD;
  rs RECORD;
  sales_vat_rate NUMERIC;
  qty NUMERIC;
  cashback_rate NUMERIC := 0;
  item_total_rounded NUMERIC;
  item_subtotal_calc NUMERIC;
  item_vat_calc NUMERIC;
BEGIN
  -- Determine which order to update
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD.order_id;
  ELSE
    target_order_id := NEW.order_id;
  END IF;

  -- Get reward settings
  SELECT * INTO rs 
  FROM public.reward_settings 
  WHERE is_active = true 
  ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, created_at DESC 
  LIMIT 1;

  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  END IF;

  -- Recalculate totals from current order items
  FOR item_rec IN SELECT * FROM public.order_items WHERE order_id = target_order_id LOOP
    sales_vat_rate := CASE WHEN item_rec.vat_rate IS NULL THEN 16 ELSE item_rec.vat_rate END;
    qty := GREATEST(COALESCE(item_rec.quantity, 1), 1);

    IF item_rec.item_type = 'servicio' THEN
      item_total_rounded := COALESCE(item_rec.unit_base_price, 0) * qty;
      item_total_rounded := item_total_rounded * (1 + sales_vat_rate / 100.0);
      item_total_rounded := item_total_rounded * (1 + cashback_rate / 100.0);
      item_total_rounded := CEIL(item_total_rounded / 10.0) * 10.0;
    ELSE
      DECLARE
        base_cost NUMERIC := COALESCE(item_rec.unit_cost_price, 0) * qty;
        profit_margin NUMERIC := COALESCE(item_rec.profit_margin_rate, 30.0);
      BEGIN
        item_total_rounded := base_cost * 1.16;
        item_total_rounded := item_total_rounded * (1 + profit_margin / 100.0);
        item_total_rounded := item_total_rounded * (1 + sales_vat_rate / 100.0);
        item_total_rounded := item_total_rounded * (1 + cashback_rate / 100.0);
        item_total_rounded := CEIL(item_total_rounded / 10.0) * 10.0;
      END;
    END IF;

    item_subtotal_calc := item_total_rounded / (1 + sales_vat_rate / 100.0);
    item_vat_calc := item_total_rounded - item_subtotal_calc;

    subtotal_amount := subtotal_amount + item_subtotal_calc;
    vat_amount := vat_amount + item_vat_calc;
    total_amount := total_amount + item_total_rounded;
  END LOOP;

  -- Update existing record or create if doesn't exist
  INSERT INTO public.order_final_totals (
    order_id,
    final_total_amount,
    display_subtotal,
    display_vat_amount,
    calculation_source,
    created_by
  ) VALUES (
    target_order_id,
    total_amount,
    subtotal_amount,
    vat_amount,
    'items_update_trigger',
    auth.uid()
  )
  ON CONFLICT (order_id) 
  DO UPDATE SET
    final_total_amount = EXCLUDED.final_total_amount,
    display_subtotal = EXCLUDED.display_subtotal,
    display_vat_amount = EXCLUDED.display_vat_amount,
    calculation_source = EXCLUDED.calculation_source,
    updated_at = now();

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update totals when order items change
CREATE TRIGGER trigger_update_order_final_totals_on_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_final_totals_on_items_change();