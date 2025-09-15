-- Final fix: ensure cashback is applied and ceilToTen works correctly
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
  -- Load reward settings 
  SELECT * INTO rs FROM public.reward_settings WHERE is_active = true LIMIT 1;
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  END IF;

  -- Process each item
  FOR item_rec IN SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
    sales_vat_rate := COALESCE(item_rec.vat_rate, 16);
    qty := GREATEST(COALESCE(item_rec.quantity, 1), 1);

    IF item_rec.item_type = 'servicio' THEN
      -- Services: base * qty * (1 + vat) * (1 + cashback) -> ceilToTen
      item_total_rounded := COALESCE(item_rec.unit_base_price, 0) * qty;
      item_total_rounded := item_total_rounded * (1 + sales_vat_rate / 100.0);
      item_total_rounded := item_total_rounded * (1 + cashback_rate / 100.0);
      item_total_rounded := CEIL(item_total_rounded / 10.0) * 10.0;
    ELSE
      -- Products: complex calculation -> ceilToTen
      DECLARE
        base_cost NUMERIC := COALESCE(item_rec.unit_cost_price, 0) * qty;
        profit_margin NUMERIC := COALESCE(item_rec.profit_margin_rate, 30.0);
      BEGIN
        item_total_rounded := base_cost * 1.16; -- purchase VAT 16%
        item_total_rounded := item_total_rounded * (1 + profit_margin / 100.0);
        item_total_rounded := item_total_rounded * (1 + sales_vat_rate / 100.0);
        item_total_rounded := item_total_rounded * (1 + cashback_rate / 100.0);
        item_total_rounded := CEIL(item_total_rounded / 10.0) * 10.0;
      END;
    END IF;

    -- Derive subtotal and VAT from rounded total
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

-- Update all totals
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
          calculated_at = now()
    WHERE order_id = rec.order_id;
  END LOOP;
END $$;

-- Refresh collections
SELECT public.refresh_pending_collections();