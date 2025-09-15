-- Refresh pending_collections to include approved or finalized orders and partial payments
CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Reset table
  TRUNCATE TABLE public.pending_collections;

  WITH base AS (
    SELECT 
      o.id,
      o.order_number,
      c.name AS client_name,
      c.email AS client_email,
      COALESCE(ot.total_amount, 0) AS total_due
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.order_totals ot ON ot.order_id = o.id
    WHERE (o.client_approval = true OR o.status = 'finalizada')
      AND COALESCE(ot.total_amount, 0) > 0
      AND o.deleted_at IS NULL
  ), paid AS (
    SELECT 
      b.id AS order_id,
      COALESCE(SUM(i.amount), 0) AS paid_amount
    FROM base b
    LEFT JOIN public.incomes i
      ON i.category = 'cobro_orden'
     AND i.status = 'recibido'
     AND i.description ILIKE '%' || b.order_number || '%'
    GROUP BY b.id
  )
  INSERT INTO public.pending_collections (
    order_id,
    order_number,
    client_name,
    client_email,
    amount,
    balance,
    created_at
  )
  SELECT 
    b.id,
    b.order_number,
    b.client_name,
    b.client_email,
    b.total_due AS amount,
    GREATEST(b.total_due - COALESCE(p.paid_amount, 0), 0) AS balance,
    now()
  FROM base b
  LEFT JOIN paid p ON p.order_id = b.id
  WHERE GREATEST(b.total_due - COALESCE(p.paid_amount, 0), 0) > 0;

  -- Log
  RAISE LOG 'Pending collections refreshed (approved or finalized orders, partial payments handled)';
END;
$function$;

-- Enable rich realtime payloads and add to publication
ALTER TABLE public.pending_collections REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_collections;