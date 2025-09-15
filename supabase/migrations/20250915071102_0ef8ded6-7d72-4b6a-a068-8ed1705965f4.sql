-- Include approved (client_approval) orders as pending collections, and keep finalized ones until fully paid
CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_rec RECORD;
  item_rec RECORD;
  total_correct NUMERIC := 0;
  item_total NUMERIC;
  is_new_client BOOLEAN;
  cashback_rate NUMERIC := 0;
  rs RECORD;
  cost_with_vat NUMERIC;
  cost_with_margin NUMERIC;
  cost_with_sales_vat NUMERIC;
  final_price NUMERIC;
  order_created_at TIMESTAMPTZ;
BEGIN
  -- Active reward settings
  SELECT * INTO rs FROM public.reward_settings WHERE is_active = true LIMIT 1;

  -- Rebuild table
  DELETE FROM public.pending_collections;

  -- Add orders: approved by client OR ever finalized, and not fully paid yet (no income referencing the order)
  FOR order_rec IN 
    SELECT DISTINCT o.id, o.order_number, o.client_id, c.name AS client_name, c.email AS client_email, o.created_at
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    WHERE (
      o.client_approval = true
      OR EXISTS (
        SELECT 1 FROM public.order_status_logs osl 
        WHERE osl.order_id = o.id 
        AND osl.new_status = 'finalizada'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.incomes i 
      WHERE i.description ILIKE '%' || o.order_number || '%'
    )
  LOOP
    total_correct := 0;
    order_created_at := order_rec.created_at;

    -- New client?
    SELECT COUNT(*) = 0 INTO is_new_client
    FROM public.orders
    WHERE client_id = order_rec.client_id
      AND status = 'finalizada'
      AND created_at < order_created_at;

    -- Cashback to apply
    IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
      cashback_rate := CASE WHEN is_new_client THEN rs.new_client_cashback_percent ELSE rs.general_cashback_percent END;
    ELSE
      cashback_rate := 0;
    END IF;

    -- Iterate items
    FOR item_rec IN SELECT * FROM public.order_items WHERE order_id = order_rec.id
    LOOP
      IF item_rec.item_type = 'servicio' THEN
        item_total := (COALESCE(item_rec.unit_base_price, 0) * GREATEST(item_rec.quantity, 1))
                      * (1 + COALESCE(item_rec.vat_rate, 0) / 100.0)
                      * (1 + cashback_rate / 100.0);
        item_total := CEIL(item_total / 10.0) * 10;
      ELSE
        cost_with_vat := COALESCE(item_rec.unit_cost_price, 0) * (1 + COALESCE(item_rec.vat_rate, 0) / 100.0);
        cost_with_margin := cost_with_vat * (1 + COALESCE(item_rec.profit_margin_rate, 0) / 100.0);
        cost_with_sales_vat := cost_with_margin * (1 + COALESCE(item_rec.vat_rate, 0) / 100.0);
        final_price := cost_with_sales_vat * (1 + cashback_rate / 100.0);
        item_total := final_price * GREATEST(item_rec.quantity, 1);
        item_total := CEIL(item_total / 10.0) * 10;
      END IF;

      total_correct := total_correct + item_total;
    END LOOP;

    INSERT INTO public.pending_collections (order_id, order_number, client_name, client_email, amount, balance)
    VALUES (order_rec.id, order_rec.order_number, order_rec.client_name, order_rec.client_email, total_correct, total_correct);
  END LOOP;
END;
$function$;

-- Refresh current data
SELECT public.refresh_pending_collections();