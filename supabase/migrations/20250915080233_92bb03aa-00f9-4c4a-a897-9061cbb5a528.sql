-- Fix to match UI exactly: ceilToTen per item after cashback, then sum
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
  
  -- For each item calculation
  base_price NUMERIC;
  after_sales_vat NUMERIC;
  final_with_cashback NUMERIC;
  item_total_rounded NUMERIC;
  item_subtotal_calc NUMERIC;
  item_vat_calc NUMERIC;
  
  -- Totals
  total_sub NUMERIC := 0;
  total_vat NUMERIC := 0;
  total_amt NUMERIC := 0;
BEGIN
  -- Load reward settings used by UI
  SELECT * INTO rs FROM public.reward_settings WHERE is_active = true LIMIT 1;
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  ELSE
    cashback_rate := 0;
  END IF;

  -- Loop order items and replicate getDisplayPrice + ceilToTen exactly
  FOR item_rec IN 
    SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
    sales_vat_rate := COALESCE(item_rec.vat_rate, 16); -- UI uses vat_rate ?? 16
    qty := GREATEST(COALESCE(item_rec.quantity, 1), 1);

    IF item_rec.item_type = 'servicio' THEN
      -- Services: basePrice -> +salesVAT -> +cashback -> ceilToTen 
      base_price := (COALESCE(item_rec.unit_base_price, 0) * qty);
      after_sales_vat := base_price * (1 + sales_vat_rate / 100.0);
      final_with_cashback := after_sales_vat * (1 + cashback_rate / 100.0);
      
      -- ceilToTen: CEIL(amount / 10) * 10
      item_total_rounded := CEIL(final_with_cashback / 10.0) * 10.0;

    ELSE
      -- Products: baseCost -> +purchaseVAT(16%) -> +margin -> +salesVAT -> +cashback -> ceilToTen
      DECLARE
        purchase_vat_rate NUMERIC := 16.0;
        base_cost NUMERIC;
        after_purchase_vat NUMERIC;
        profit_margin NUMERIC;
        after_margin NUMERIC;
        after_sales_vat_prod NUMERIC;
      BEGIN
        base_cost := COALESCE(item_rec.unit_cost_price, 0) * qty;
        after_purchase_vat := base_cost * (1 + purchase_vat_rate / 100.0);
        profit_margin := COALESCE(item_rec.profit_margin_rate, 30.0);
        after_margin := after_purchase_vat * (1 + profit_margin / 100.0);
        after_sales_vat_prod := after_margin * (1 + sales_vat_rate / 100.0);
        final_with_cashback := after_sales_vat_prod * (1 + cashback_rate / 100.0);
        
        -- ceilToTen: CEIL(amount / 10) * 10
        item_total_rounded := CEIL(final_with_cashback / 10.0) * 10.0;
      END;
    END IF;

    -- Now derive subtotal and vat from the rounded total (like usePricingCalculation.tsx does)
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

-- Recalculate all order totals with the corrected logic
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

-- Refresh pending collections with new totals
SELECT public.refresh_pending_collections();