-- Drop existing view
DROP VIEW IF EXISTS pending_collections;

-- Create updated view with cashback calculation
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
    
    -- Calculate cashback (2% on subtotal)
    COALESCE(vat_data.subtotal_without_vat, 0::numeric) AS original_subtotal,
    ROUND(COALESCE(vat_data.subtotal_without_vat, 0::numeric) * 0.02, 2) AS cashback_amount,
    ROUND(COALESCE(vat_data.subtotal_without_vat, 0::numeric) * 0.98, 2) AS subtotal_without_vat,
    
    -- Recalculate VAT on discounted subtotal
    ROUND(COALESCE(vat_data.subtotal_without_vat, 0::numeric) * 0.98 * 0.16, 2) AS total_vat_amount,
    
    -- Calculate total with VAT after cashback
    ROUND(COALESCE(vat_data.subtotal_without_vat, 0::numeric) * 0.98 * 1.16, 2) AS total_with_vat,
    
    -- Calculate remaining balance based on discounted total
    GREATEST(
        ROUND(COALESCE(vat_data.subtotal_without_vat, 0::numeric) * 0.98 * 1.16, 2) - COALESCE(payments.total_paid, 0::numeric), 
        0::numeric
    ) AS remaining_balance
FROM orders o
JOIN clients c ON o.client_id = c.id
LEFT JOIN (
    SELECT 
        order_payments.order_id,
        SUM(order_payments.payment_amount) AS total_paid
    FROM order_payments
    GROUP BY order_payments.order_id
) payments ON o.id = payments.order_id
LEFT JOIN (
    SELECT 
        order_items.order_id,
        SUM(order_items.subtotal) AS subtotal_without_vat
    FROM order_items
    GROUP BY order_items.order_id
) vat_data ON o.id = vat_data.order_id
WHERE o.status != 'cancelada'::order_status 
  AND ROUND(COALESCE(vat_data.subtotal_without_vat, 0::numeric) * 0.98 * 1.16, 2) > COALESCE(payments.total_paid, 0::numeric);