-- Recompute pending_collections amounts using calculate_order_total, preserving paid amounts
CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  calc RECORD;
  paid NUMERIC;
  new_balance NUMERIC;
BEGIN
  FOR rec IN SELECT * FROM public.pending_collections LOOP
    SELECT * INTO calc FROM public.calculate_order_total(rec.order_id);
    IF calc.total_amount IS NULL THEN
      CONTINUE;
    END IF;
    paid := GREATEST(COALESCE(rec.amount,0) - COALESCE(rec.balance,0), 0);
    new_balance := GREATEST(calc.total_amount - paid, 0);

    UPDATE public.pending_collections 
    SET amount = calc.total_amount,
        balance = new_balance
    WHERE id = rec.id;
  END LOOP;
END;
$function$;

-- Run refresh to apply changes now
SELECT public.refresh_pending_collections();