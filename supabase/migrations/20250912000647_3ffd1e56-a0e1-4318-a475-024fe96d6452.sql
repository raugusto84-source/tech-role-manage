-- Update pending_collections to round totals up to the next multiple of 10 and affect remaining balance
DROP VIEW IF EXISTS pending_collections;

CREATE VIEW pending_collections AS
WITH item_totals AS (
  SELECT 
    oi.order_id,
    SUM(oi.subtotal) AS subtotal_amount,
    SUM(oi.vat_amount) AS vat_amount,
    SUM(oi.total_amount) AS total_amount
  FROM order_items oi
  GROUP BY oi.order_id
), payments AS (
  SELECT 
    op.order_id,
    SUM(op.payment_amount) AS total_paid
  FROM order_payments op
  GROUP BY op.order_id
), base AS (
  SELECT 
    o.id,
    o.order_number,
    o.client_id,
    c.name AS client_name,
    c.email AS client_email,
    o.created_at,
    o.delivery_date,
    o.updated_at,
    o.status,
    -- Informational fields
    COALESCE(
      o.approved_subtotal,
      item_totals.subtotal_amount,
      CASE WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.86 ELSE 0 END
    ) AS subtotal_without_vat,
    COALESCE(
      o.approved_vat_amount,
      item_totals.vat_amount,
      CASE WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.14 ELSE 0 END
    ) AS total_vat_amount,
    -- Base total before rounding
    COALESCE(
      o.approved_total,
      o.estimated_cost,
      item_totals.total_amount,
      0
    ) AS base_total,
    COALESCE(payments.total_paid, 0) AS total_paid
  FROM orders o
  JOIN clients c ON c.id = o.client_id
  LEFT JOIN item_totals ON item_totals.order_id = o.id
  LEFT JOIN payments ON payments.order_id = o.id
  WHERE o.status <> 'cancelada'
)
SELECT 
  id,
  order_number,
  client_id,
  client_name,
  client_email,
  created_at,
  delivery_date,
  updated_at,
  subtotal_without_vat,
  total_vat_amount,
  -- Rounded totals: up to next multiple of 10, removing cents and units
  CEIL(base_total / 10.0) * 10 AS estimated_cost,
  CEIL(base_total / 10.0) * 10 AS total_with_vat,
  total_paid,
  GREATEST(CEIL(base_total / 10.0) * 10 - total_paid, 0) AS remaining_balance
FROM base
WHERE 
  (status = 'finalizada' AND CEIL(base_total / 10.0) * 10 > total_paid)
  OR (status <> 'finalizada' AND CEIL(base_total / 10.0) * 10 > 0);