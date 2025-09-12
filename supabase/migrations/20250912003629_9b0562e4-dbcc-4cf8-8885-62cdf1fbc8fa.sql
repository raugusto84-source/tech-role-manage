-- Recalculate pending_collections totals using the same pricing logic as the app (cashback + product margin)
DROP VIEW IF EXISTS pending_collections;

CREATE VIEW pending_collections AS
WITH rs AS (
  SELECT 
    COALESCE(general_cashback_percent, 0)::numeric AS cashback_pct,
    COALESCE(apply_cashback_to_items, false) AS apply_cashback
  FROM reward_settings
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1
), item_totals AS (
  SELECT 
    oi.order_id,
    SUM(COALESCE(oi.subtotal, 0)) AS subtotal_amount,
    SUM(COALESCE(oi.vat_amount, 0)) AS vat_amount,
    SUM(COALESCE(oi.total_amount, 0)) AS total_amount,
    -- Recalculated total using app logic
    SUM(
      CASE 
        WHEN COALESCE(oi.item_type, 'servicio') = 'servicio' THEN
          (
            COALESCE(oi.unit_base_price, 0) * (1 + COALESCE(oi.vat_rate, 0) / 100.0)
            * (1 + (CASE WHEN rs.apply_cashback THEN rs.cashback_pct ELSE 0 END) / 100.0)
          ) * COALESCE(oi.quantity, 1)
        ELSE
          (
            (COALESCE(oi.unit_cost_price, 0) * 1.16) -- purchase VAT 16%
            * (1 + COALESCE(oi.profit_margin_rate, 30) / 100.0)
            * (1 + COALESCE(oi.vat_rate, 0) / 100.0)
            * (1 + (CASE WHEN rs.apply_cashback THEN rs.cashback_pct ELSE 0 END) / 100.0)
          ) * COALESCE(oi.quantity, 1)
      END
    ) AS recalculated_total
  FROM order_items oi
  CROSS JOIN rs
  GROUP BY oi.order_id
), payments AS (
  SELECT 
    op.order_id,
    SUM(COALESCE(op.payment_amount, 0)) AS total_paid
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
    -- Informational fields (fallbacks only used when no items)
    COALESCE(
      item_totals.subtotal_amount,
      o.approved_subtotal,
      CASE WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.86 ELSE 0 END
    ) AS subtotal_without_vat,
    COALESCE(
      item_totals.vat_amount,
      o.approved_vat_amount,
      CASE WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.14 ELSE 0 END
    ) AS total_vat_amount,
    -- Base total before rounding (PRIORITY: recalculated -> item totals -> approved_total -> estimated)
    COALESCE(
      item_totals.recalculated_total,
      item_totals.total_amount,
      o.approved_total,
      o.estimated_cost,
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
  -- Rounded totals: up to next multiple of 10
  CEIL(base_total / 10.0) * 10 AS estimated_cost,
  CEIL(base_total / 10.0) * 10 AS total_with_vat,
  total_paid,
  GREATEST(CEIL(base_total / 10.0) * 10 - total_paid, 0) AS remaining_balance
FROM base
WHERE 
  (status = 'finalizada' AND CEIL(base_total / 10.0) * 10 > total_paid)
  OR (status <> 'finalizada' AND CEIL(base_total / 10.0) * 10 > 0);