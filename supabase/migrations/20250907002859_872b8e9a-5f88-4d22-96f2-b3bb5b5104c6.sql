-- Revert pending_collections to use full total without cashback
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

    -- Totals from items (no cashback applied)
    COALESCE(vat_data.subtotal_without_vat, 0::numeric) AS subtotal_without_vat,
    COALESCE(vat_data.total_vat_amount, 0::numeric) AS total_vat_amount,
    COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric) AS total_with_vat,

    -- Remaining balance based on full total
    GREATEST(
        COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric) - COALESCE(payments.total_paid, 0::numeric),
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
WHERE o.status <> 'cancelada'::order_status
  AND COALESCE(vat_data.total_with_vat, o.estimated_cost, 0::numeric) > COALESCE(payments.total_paid, 0::numeric);