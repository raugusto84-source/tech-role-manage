-- Fix refresh_pending_collections to use order_totals table

CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Clear existing pending collections
  TRUNCATE TABLE public.pending_collections;
  
  -- Insert finalized orders with pending collections using order_totals
  INSERT INTO public.pending_collections (
    order_id,
    order_number,
    client_name,
    client_email,
    amount,
    balance,
    created_at
  )
  SELECT DISTINCT
    o.id,
    o.order_number,
    c.name,
    c.email,
    COALESCE(ot.total_amount, 0) as amount,
    COALESCE(ot.total_amount, 0) as balance,
    o.created_at
  FROM public.orders o
  JOIN public.clients c ON c.id = o.client_id
  LEFT JOIN public.order_totals ot ON ot.order_id = o.id
  WHERE o.status = 'finalizada'::order_status
    AND o.deleted_at IS NULL
    AND COALESCE(ot.total_amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.incomes i
      WHERE i.description LIKE '%' || o.order_number || '%'
        AND i.category = 'cobro_orden'
        AND i.amount >= COALESCE(ot.total_amount, 0)
    );
    
  -- Log refresh action
  RAISE LOG 'Pending collections refreshed using order_totals';
END;
$function$;