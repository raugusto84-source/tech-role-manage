-- Use most recent active reward settings to ensure correct cashback
CREATE OR REPLACE FUNCTION public.calculate_order_total(p_order_id UUID)
RETURNS TABLE(subtotal NUMERIC, vat_amount NUMERIC, total_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_rec RECORD;
  rs RECORD;
  sales_vat_rate NUMERIC;
  qty NUMERIC;
  cashback_rate NUMERIC := 0;
  item_total_rounded NUMERIC;
  item_subtotal_calc NUMERIC;
  item_vat_calc NUMERIC;
  total_sub NUMERIC := 0;
  total_vat NUMERIC := 0;
  total_amt NUMERIC := 0;
BEGIN
  -- Pick the latest active settings
  SELECT * INTO rs 
  FROM public.reward_settings 
  WHERE is_active = true 
  ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, created_at DESC 
  LIMIT 1;

  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  END IF;

  FOR item_rec IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
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

    total_sub := total_sub + item_subtotal_calc;
    total_vat := total_vat + item_vat_calc;
    total_amt := total_amt + item_total_rounded;
  END LOOP;

  subtotal := total_sub;
  vat_amount := total_vat;
  total_amount := total_amt;
  RETURN NEXT;
END;
$function$;

-- Recalculate totals and refresh collections
DO $$
DECLARE
  rec RECORD;
  calc RECORD;
BEGIN
  FOR rec IN SELECT order_id FROM public.order_totals LOOP
    SELECT * INTO calc FROM public.calculate_order_total(rec.order_id);
    UPDATE public.order_totals 
      SET subtotal = calc.subtotal,
          vat_amount = calc.vat_amount,
          total_amount = calc.total_amount,
          calculated_at = now(),
          updated_at = now()
    WHERE order_id = rec.order_id;
  END LOOP;
END $$;

SELECT public.refresh_pending_collections();