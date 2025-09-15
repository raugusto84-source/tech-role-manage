-- Fix calculation order to match UI: apply cashback before rounding, round only final per item
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
  item_subtotal NUMERIC;
  item_vat NUMERIC;
  item_total NUMERIC;
  total_sub NUMERIC := 0;
  total_vat NUMERIC := 0;
  total_amt NUMERIC := 0;
  cashback_rate NUMERIC := 0;
BEGIN
  -- 1) Load reward settings used by UI
  SELECT * INTO rs FROM public.reward_settings WHERE is_active = true LIMIT 1;
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  ELSE
    cashback_rate := 0;
  END IF;

  -- 2) Loop order items and reproduce UI pricing exactly
  FOR item_rec IN 
    SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
    sales_vat_rate := COALESCE(item_rec.vat_rate, 0);
    qty := GREATEST(COALESCE(item_rec.quantity, 1), 1);

    IF item_rec.item_type = 'servicio' THEN
      -- Servicios: base -> +IVA venta -> +cashback -> redondeo SOLO al total
      item_total := (COALESCE(item_rec.unit_base_price, 0) * qty);
      item_total := item_total * (1 + sales_vat_rate / 100.0);
      item_total := item_total * (1 + cashback_rate / 100.0);

      -- ceilToTen (solo total)
      item_total := CEIL(item_total / 10.0) * 10.0;

      -- Derivar subtotal y IVA desde el total redondeado
      item_subtotal := item_total / (1 + sales_vat_rate / 100.0);
      item_vat := item_total - item_subtotal;

    ELSE
      -- Artículos: costo -> +IVA compra(16%) -> +margen -> +IVA venta -> +cashback -> redondeo SOLO al total
      DECLARE
        purchase_vat_rate NUMERIC := 16.0;
        base_cost NUMERIC;
        after_purchase_vat NUMERIC;
        profit_margin NUMERIC;
        after_margin NUMERIC;
        after_sales_vat NUMERIC;
      BEGIN
        base_cost := COALESCE(item_rec.unit_cost_price, 0) * qty;
        after_purchase_vat := base_cost * (1 + purchase_vat_rate / 100.0);
        profit_margin := COALESCE(item_rec.profit_margin_rate, 30.0);
        after_margin := after_purchase_vat * (1 + profit_margin / 100.0);
        after_sales_vat := after_margin * (1 + sales_vat_rate / 100.0);
        item_total := after_sales_vat * (1 + cashback_rate / 100.0);

        -- ceilToTen (solo total)
        item_total := CEIL(item_total / 10.0) * 10.0;

        -- Derivar subtotal y IVA desde el total redondeado
        item_subtotal := item_total / (1 + sales_vat_rate / 100.0);
        item_vat := item_total - item_subtotal;
      END;
    END IF;

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

-- Recalculate persisted totals using the corrected function
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

-- Refresh pending collections to reflect new totals
SELECT public.refresh_pending_collections();