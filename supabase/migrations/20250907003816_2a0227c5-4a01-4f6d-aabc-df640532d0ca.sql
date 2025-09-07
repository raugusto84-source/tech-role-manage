-- Update pending_collections to reflect full customer total (reverse cashback effect)
DROP VIEW IF EXISTS pending_collections;

CREATE VIEW pending_collections AS
SELECT 
    o.id,
    o.order_number,
    o.client_id,
    c.name AS client_name,
    c.email AS client_email,
    o.estimated_cost,
    o.delivery_date,
    o.created_at,
    o.updated_at,
    COALESCE(payments.total_paid, 0::numeric) AS total_paid,

    -- Active reward settings (single row expected)
    COALESCE(rs.apply_cashback_to_items, false) AS cashback_enabled,
    COALESCE(rs.general_cashback_percent, 0)::numeric AS cashback_percent,

    -- Base totals from items (as stored)
    COALESCE(vat_data.subtotal_without_vat, 0::numeric) AS base_subtotal_without_vat,
    COALESCE(vat_data.total_vat_amount, 0::numeric) AS base_total_vat_amount,
    COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric) AS base_total_with_vat,

    -- Adjusted totals to reflect full customer total without cashback reduction
    CASE 
      WHEN COALESCE(rs.apply_cashback_to_items, false) AND COALESCE(rs.general_cashback_percent, 0) > 0 
        THEN COALESCE(vat_data.subtotal_without_vat, 0::numeric) * (1 + rs.general_cashback_percent / 100.0)
      ELSE COALESCE(vat_data.subtotal_without_vat, 0::numeric)
    END AS subtotal_without_vat,
    CASE 
      WHEN COALESCE(rs.apply_cashback_to_items, false) AND COALESCE(rs.general_cashback_percent, 0) > 0 
        THEN COALESCE(vat_data.total_vat_amount, 0::numeric) * (1 + rs.general_cashback_percent / 100.0)
      ELSE COALESCE(vat_data.total_vat_amount, 0::numeric)
    END AS total_vat_amount,
    CASE 
      WHEN COALESCE(rs.apply_cashback_to_items, false) AND COALESCE(rs.general_cashback_percent, 0) > 0 
        THEN COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric) * (1 + rs.general_cashback_percent / 100.0)
      ELSE COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric)
    END AS total_with_vat,

    -- Remaining balance from adjusted total
    GREATEST(
      (CASE 
        WHEN COALESCE(rs.apply_cashback_to_items, false) AND COALESCE(rs.general_cashback_percent, 0) > 0 
          THEN COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric) * (1 + rs.general_cashback_percent / 100.0)
        ELSE COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric)
      END) - COALESCE(payments.total_paid, 0::numeric),
      0::numeric
    ) AS remaining_balance
FROM orders o
JOIN clients c ON o.client_id = c.id
LEFT JOIN (
    SELECT 
        op.order_id,
        SUM(op.payment_amount) AS total_paid
    FROM order_payments op
    GROUP BY op.order_id
) payments ON o.id = payments.order_id
LEFT JOIN (
    SELECT 
        oi.order_id,
        SUM(oi.subtotal) AS subtotal_without_vat,
        SUM(oi.vat_amount) AS total_vat_amount,
        SUM(oi.total_amount) AS total_with_vat
    FROM order_items oi
    GROUP BY oi.order_id
) vat_data ON o.id = vat_data.order_id
LEFT JOIN reward_settings rs ON rs.is_active = true
WHERE o.status <> 'cancelada'::order_status
  AND (
    CASE 
      WHEN COALESCE(rs.apply_cashback_to_items, false) AND COALESCE(rs.general_cashback_percent, 0) > 0 
        THEN COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric) * (1 + rs.general_cashback_percent / 100.0)
      ELSE COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric)
    END
  ) > COALESCE(payments.total_paid, 0::numeric);
