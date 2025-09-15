-- Re-apply function (ensures it's updated even if previous tx failed)
CREATE OR REPLACE FUNCTION public.create_pending_collection_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_total NUMERIC := 0;
  order_subtotal NUMERIC := 0;
  order_vat_total NUMERIC := 0;
  client_name_val TEXT;
  client_email_val TEXT;
  existing_total_paid NUMERIC := 0;
  collection_exists BOOLEAN;
BEGIN
  IF (NEW.client_approval = true AND OLD.client_approval IS DISTINCT FROM true) OR
     (NEW.status = 'en_proceso' AND OLD.status != 'en_proceso' AND NEW.client_approval = true) THEN

    SELECT EXISTS (
      SELECT 1 FROM pending_collections WHERE order_id = NEW.id
    ) INTO collection_exists;

    SELECT c.name, c.email
    INTO client_name_val, client_email_val
    FROM clients c
    WHERE c.id = NEW.client_id;

    SELECT 
      COALESCE(SUM(oi.subtotal), 0),
      COALESCE(SUM(oi.vat_amount), 0),
      COALESCE(SUM(oi.total_amount), 0)
    INTO order_subtotal, order_vat_total, order_total
    FROM order_items oi
    WHERE oi.order_id = NEW.id;

    IF order_total = 0 THEN
      order_total := COALESCE(NEW.estimated_cost, 0);
      order_subtotal := ROUND(order_total / 1.16, 2);
      order_vat_total := order_total - order_subtotal;
    END IF;

    IF collection_exists THEN
      SELECT COALESCE(total_paid, 0) INTO existing_total_paid
      FROM pending_collections
      WHERE order_id = NEW.id;

      UPDATE pending_collections
      SET 
        order_number = NEW.order_number,
        client_name = COALESCE(client_name_val, client_name),
        client_email = COALESCE(client_email_val, client_email),
        estimated_cost = order_total,
        delivery_date = NEW.delivery_date,
        total_vat_amount = order_vat_total,
        subtotal_without_vat = order_subtotal,
        total_with_vat = order_total,
        remaining_balance = GREATEST(order_total - existing_total_paid, 0),
        updated_at = now()
      WHERE order_id = NEW.id;
    ELSE
      INSERT INTO pending_collections (
        order_id,
        order_number,
        client_name,
        client_email,
        estimated_cost,
        delivery_date,
        total_paid,
        remaining_balance,
        total_vat_amount,
        subtotal_without_vat,
        total_with_vat
      ) VALUES (
        NEW.id,
        NEW.order_number,
        COALESCE(client_name_val, 'Cliente no encontrado'),
        COALESCE(client_email_val, ''),
        order_total,
        NEW.delivery_date,
        0,
        order_total,
        order_vat_total,
        order_subtotal,
        order_total
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix existing rows with zero totals
WITH totals AS (
  SELECT 
    oi.order_id,
    COALESCE(SUM(oi.subtotal), 0) AS subtotal,
    COALESCE(SUM(oi.vat_amount), 0) AS vat,
    COALESCE(SUM(oi.total_amount), 0) AS total
  FROM order_items oi
  GROUP BY oi.order_id
)
UPDATE pending_collections pc
SET 
  estimated_cost = COALESCE(t.total, COALESCE(o.estimated_cost, 0)),
  total_vat_amount = COALESCE(t.vat, GREATEST(COALESCE(o.estimated_cost, 0) - ROUND(COALESCE(o.estimated_cost, 0) / 1.16, 2), 0)),
  subtotal_without_vat = COALESCE(t.subtotal, ROUND(COALESCE(o.estimated_cost, 0) / 1.16, 2)),
  total_with_vat = COALESCE(t.total, COALESCE(o.estimated_cost, 0)),
  remaining_balance = GREATEST(COALESCE(t.total, COALESCE(o.estimated_cost, 0)) - COALESCE(pc.total_paid, 0), 0),
  updated_at = now()
FROM orders o
LEFT JOIN totals t ON t.order_id = o.id
WHERE pc.total_with_vat = 0
  AND o.id = pc.order_id;