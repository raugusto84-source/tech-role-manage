-- Align server totals with UI calculation - simplified approach
CREATE OR REPLACE FUNCTION public.calculate_order_total(p_order_id UUID)
RETURNS TABLE(subtotal NUMERIC, vat_amount NUMERIC, total_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_rec RECORD;
  rs RECORD;
  item_subtotal NUMERIC;
  item_vat NUMERIC;
  item_total NUMERIC;
  total_sub NUMERIC := 0;
  total_vat NUMERIC := 0;
  total_amt NUMERIC := 0;
  cashback_rate NUMERIC := 0;
BEGIN
  -- Get reward settings - UI applies ONLY general_cashback_percent
  SELECT * INTO rs FROM public.reward_settings WHERE is_active = true LIMIT 1;
  
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  ELSE
    cashback_rate := 0;
  END IF;
  
  -- Calculate totals using same logic as UI (calculateItemDisplayPrice + ceilToTen)
  FOR item_rec IN 
    SELECT * FROM public.order_items 
    WHERE order_id = p_order_id
  LOOP
    IF item_rec.item_type = 'servicio' THEN
      -- Services: base price + sales VAT + cashback
      item_subtotal := (COALESCE(item_rec.unit_base_price, 0) * GREATEST(item_rec.quantity, 1));
      item_vat := item_subtotal * (COALESCE(item_rec.vat_rate, 0) / 100.0);
      item_total := (item_subtotal + item_vat) * (1 + cashback_rate / 100.0);
    ELSE
      -- Products: cost + purchase VAT + margin + sales VAT + cashback
      DECLARE
        purchase_vat_rate NUMERIC := 16.0;
        after_purchase_vat NUMERIC;
        after_margin NUMERIC;
        after_sales_vat NUMERIC;
        profit_margin NUMERIC;
      BEGIN
        profit_margin := COALESCE(item_rec.profit_margin_rate, 30.0);
        after_purchase_vat := COALESCE(item_rec.unit_cost_price, 0) * GREATEST(item_rec.quantity, 1) * (1 + purchase_vat_rate / 100.0);
        after_margin := after_purchase_vat * (1 + profit_margin / 100.0);
        after_sales_vat := after_margin * (1 + COALESCE(item_rec.vat_rate, 0) / 100.0);
        item_total := after_sales_vat * (1 + cashback_rate / 100.0);
        item_subtotal := item_total / (1 + COALESCE(item_rec.vat_rate, 0) / 100.0);
        item_vat := item_total - item_subtotal;
      END;
    END IF;

    -- Ceiling to 10 per item (matches UI ceilToTen behavior)
    item_total := CEIL(item_total / 10.0) * 10;
    item_subtotal := CEIL(item_subtotal / 10.0) * 10;
    item_vat := item_total - item_subtotal;
    
    total_sub := total_sub + item_subtotal;
    total_vat := total_vat + item_vat;
    total_amt := total_amt + item_total;
  END LOOP;
  
  subtotal := total_sub;
  vat_amount := total_vat;
  total_amount := total_amt;
  RETURN NEXT;
END;
$function$;

-- Recalculate order totals one by one to avoid syntax issues
DO $$
DECLARE
  order_id_rec UUID;
  calc_result RECORD;
BEGIN
  FOR order_id_rec IN SELECT order_id FROM public.order_totals LOOP
    SELECT * INTO calc_result FROM public.calculate_order_total(order_id_rec);
    
    UPDATE public.order_totals 
    SET 
      subtotal = calc_result.subtotal,
      vat_amount = calc_result.vat_amount,
      total_amount = calc_result.total_amount,
      calculated_at = now(),
      updated_at = now()
    WHERE order_id = order_id_rec;
  END LOOP;
END $$;

-- Refresh pending collections
SELECT public.refresh_pending_collections();