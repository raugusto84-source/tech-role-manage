-- Actualizar vista pending_collections para usar el total correcto de los items
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
  -- Para subtotal sin IVA: usar approved_subtotal o calcular desde items
  COALESCE(
    o.approved_subtotal,
    item_totals.subtotal_amount,
    CASE 
      WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.86
      ELSE 0
    END
  ) AS subtotal_without_vat,
  -- Para IVA: usar approved_vat_amount o calcular desde items  
  COALESCE(
    o.approved_vat_amount,
    item_totals.vat_amount,
    CASE 
      WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.14
      ELSE 0
    END
  ) AS total_vat_amount,
  -- TOTAL PRINCIPAL: Priorizar total de items (verde) sobre estimated_cost
  COALESCE(
    o.approved_total,
    item_totals.total_amount,  -- Este es el total verde de los items
    o.estimated_cost,
    0
  ) AS estimated_cost,
  -- Mismo valor para total_with_vat (compatibilidad)
  COALESCE(
    o.approved_total,
    item_totals.total_amount,  -- Prioridad al total de items
    o.estimated_cost,
    0
  ) AS total_with_vat,
  COALESCE(payments.total_paid, 0) AS total_paid,
  -- Saldo = Total de items - Pagado
  GREATEST(
    COALESCE(
      o.approved_total,
      item_totals.total_amount,
      o.estimated_cost,
      0
    ) - COALESCE(payments.total_paid, 0),
    0
  ) AS remaining_balance
FROM orders o
JOIN clients c ON c.id = o.client_id
LEFT JOIN (
  SELECT 
    oi.order_id,
    SUM(oi.subtotal) AS subtotal_amount,
    SUM(oi.vat_amount) AS vat_amount,
    SUM(oi.total_amount) AS total_amount  -- Total real de items con cashback
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
  o.status != 'cancelada'
  AND (
    (o.status = 'finalizada' AND 
     COALESCE(o.approved_total, item_totals.total_amount, o.estimated_cost, 0) > 
     COALESCE(payments.total_paid, 0)
    ) OR 
    (o.status != 'finalizada' AND 
     COALESCE(o.approved_total, item_totals.total_amount, o.estimated_cost, 0) > 0
    )
  );