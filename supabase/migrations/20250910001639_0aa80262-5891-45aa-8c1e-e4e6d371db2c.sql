-- Modificar la vista pending_collections para incluir órdenes recién creadas
-- que aún no han sido finalizadas pero ya tienen items
DROP VIEW IF EXISTS pending_collections;

CREATE VIEW pending_collections AS
SELECT 
    o.id,
    o.order_number,
    o.client_id,
    c.name as client_name,
    c.email as client_email,
    o.created_at,
    o.delivery_date,
    o.updated_at,
    
    -- Use actual totals from order_items, fallback to estimated_cost if no items yet
    COALESCE(item_totals.subtotal_amount, 
             CASE 
                WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.86
                ELSE 0 
             END) as subtotal_without_vat,
    COALESCE(item_totals.vat_amount, 
             CASE 
                WHEN o.estimated_cost > 0 THEN o.estimated_cost * 0.14
                ELSE 0 
             END) as total_vat_amount,  
    COALESCE(item_totals.total_amount, o.estimated_cost, 0) as estimated_cost,
    COALESCE(item_totals.total_amount, o.estimated_cost, 0) as total_with_vat,
    
    COALESCE(payments.total_paid, 0) as total_paid,
    GREATEST(COALESCE(item_totals.total_amount, o.estimated_cost, 0) - COALESCE(payments.total_paid, 0), 0) as remaining_balance
FROM orders o
JOIN clients c ON c.id = o.client_id
LEFT JOIN (
    SELECT 
        oi.order_id,
        SUM(oi.subtotal) as subtotal_amount,
        SUM(oi.vat_amount) as vat_amount,
        SUM(oi.total_amount) as total_amount
    FROM order_items oi
    GROUP BY oi.order_id
) item_totals ON item_totals.order_id = o.id
LEFT JOIN (
    SELECT 
        op.order_id,
        SUM(op.payment_amount) as total_paid
    FROM order_payments op
    GROUP BY op.order_id
) payments ON payments.order_id = o.id
WHERE o.status NOT IN ('cancelada') -- Excluir solo las órdenes canceladas
AND (
    -- Incluir órdenes finalizadas con saldo pendiente
    (o.status = 'finalizada' AND COALESCE(item_totals.total_amount, o.estimated_cost, 0) > COALESCE(payments.total_paid, 0))
    OR
    -- Incluir órdenes no finalizadas que tienen costo estimado o items
    (o.status != 'finalizada' AND (o.estimated_cost > 0 OR item_totals.total_amount > 0))
);