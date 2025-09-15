-- Debug: Check if refresh_pending_collections function is working
-- Let's add some logging and run it again
CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  cashback_rate NUMERIC := 0;
  rs RECORD;
  paid NUMERIC;
  new_balance NUMERIC;
  total NUMERIC;
  item RECORD;
BEGIN
  -- Load cashback settings; fallback to 0 if none
  SELECT * INTO rs 
  FROM public.reward_settings 
  WHERE is_active = true 
  ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, created_at DESC 
  LIMIT 1;
  
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := COALESCE(rs.general_cashback_percent, 0);
  END IF;

  RAISE LOG 'Cashback rate found: %', cashback_rate;

  -- Update each pending collection
  FOR rec IN SELECT * FROM public.pending_collections LOOP
    total := 0;
    
    FOR item IN SELECT * FROM public.order_items WHERE order_id = rec.order_id LOOP
      DECLARE 
        vat NUMERIC := CASE WHEN item.vat_rate IS NULL THEN 16 ELSE item.vat_rate END;
        qty NUMERIC := GREATEST(COALESCE(item.quantity,1),1);
        computed NUMERIC := 0;
      BEGIN
        IF item.item_type = 'servicio' THEN
          computed := COALESCE(item.unit_base_price,0) * qty;
          computed := computed * (1 + vat/100.0);
          computed := computed * (1 + cashback_rate/100.0);
        ELSE
          DECLARE base_cost NUMERIC := COALESCE(item.unit_cost_price,0) * qty;
                  margin NUMERIC := COALESCE(item.profit_margin_rate,30.0);
          BEGIN
            computed := base_cost * 1.16; -- purchase VAT
            computed := computed * (1 + margin/100.0);
            computed := computed * (1 + vat/100.0);
            computed := computed * (1 + cashback_rate/100.0);
          END;
        END IF;
        -- ceilToTen per item
        computed := CEIL(computed / 10.0) * 10.0;
        total := total + computed;
        
        RAISE LOG 'Item: % - Type: % - Computed: % - Running total: %', 
          item.service_name, item.item_type, computed, total;
      END;
    END LOOP;

    paid := GREATEST(COALESCE(rec.amount,0) - COALESCE(rec.balance,0), 0);
    new_balance := GREATEST(total - paid, 0);

    RAISE LOG 'Order % - Old amount: % - New total: % - New balance: %', 
      rec.order_id, rec.amount, total, new_balance;

    UPDATE public.pending_collections 
    SET amount = total,
        balance = new_balance
    WHERE id = rec.id;
  END LOOP;
END;
$function$;

-- Run the function with logging
SELECT public.refresh_pending_collections();