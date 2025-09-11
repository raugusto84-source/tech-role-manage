-- Re-crear la vista pending_collections para priorizar el TOTAL de la orden (estimated_cost) sobre la suma de items
DROP VIEW IF EXISTS pending_collections;

CREATE VIEW pending_collections AS
SELECT 
  o.id,
  o.order_number,
  o.client_id,
  c.name AS client_name,
  c.email AS client_email,
  o.created_at,
  o.delivery_date,
  o.updated_at,
  -- Subtotal y IVA (solo informativos; ya no se usan en UI)
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
  -- TOTAL: aprobado > estimated_cost (total de la orden con reglas) > suma de items
  COALESCE(
    o.approved_total,
    o.estimated_cost,
    item_totals.total_amount,
    0
  ) AS estimated_cost,
  COALESCE(
    o.approved_total,
    o.estimated_cost,
    item_totals.total_amount,
    0
  ) AS total_with_vat,
  COALESCE(payments.total_paid, 0) AS total_paid,
  GREATEST(
    COALESCE(o.approved_total, o.estimated_cost, item_totals.total_amount, 0) - COALESCE(payments.total_paid, 0),
    0
  ) AS remaining_balance
FROM orders o
JOIN clients c ON c.id = o.client_id
LEFT JOIN (
  SELECT 
    oi.order_id,
    SUM(oi.subtotal) AS subtotal_amount,
    SUM(oi.vat_amount) AS vat_amount,
    SUM(oi.total_amount) AS total_amount
  FROM order_items oi
  GROUP BY oi.order_id
) item_totals ON item_totals.order_id = o.id
LEFT JOIN (
  SELECT 
    op.order_id,
    SUM(op.payment_amount) AS total_paid
  FROM order_payments op
  GROUP BY op.order_id
) payments ON payments.order_id = o.id
WHERE 
  o.status <> 'cancelada'
  AND (
    (o.status = 'finalizada' AND COALESCE(o.approved_total, o.estimated_cost, item_totals.total_amount, 0) > COALESCE(payments.total_paid, 0))
    OR (o.status <> 'finalizada' AND COALESCE(o.approved_total, o.estimated_cost, item_totals.total_amount, 0) > 0)
  );