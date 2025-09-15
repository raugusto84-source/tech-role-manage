-- Fix refresh_pending_collections to use client-approved orders and avoid unsafe DELETE
CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  stored_total NUMERIC;
BEGIN
  -- Safer reset of the table
  TRUNCATE TABLE public.pending_collections;

  -- Insert collections for client-approved orders using stored Total General
  FOR rec IN
    SELECT 
      o.id AS order_id,
      o.order_number,
      c.name AS client_name,
      c.email AS client_email,
      ot.total_amount
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.order_totals ot ON ot.order_id = o.id
    WHERE COALESCE(o.client_approval, false) = true
      AND COALESCE(ot.total_amount, 0) > 0
  LOOP
    stored_total := COALESCE(rec.total_amount, 0);

    INSERT INTO public.pending_collections (
      order_id,
      order_number,
      client_name,
      client_email,
      amount,
      balance
    ) VALUES (
      rec.order_id,
      rec.order_number,
      rec.client_name,
      rec.client_email,
      stored_total,
      stored_total
    );
  END LOOP;

  RAISE LOG 'Pending collections refreshed from client-approved orders';
END;
$$;