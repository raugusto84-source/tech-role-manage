-- Fix existing pending_collections with zero totals using the correct totals from order_items or estimated_cost
DO $$
DECLARE
    rec RECORD;
    order_total NUMERIC := 0;
    order_subtotal NUMERIC := 0;
    order_vat_total NUMERIC := 0;
BEGIN
    -- Loop through pending_collections with zero totals
    FOR rec IN 
        SELECT pc.order_id, pc.id as pc_id, o.estimated_cost
        FROM pending_collections pc
        JOIN orders o ON o.id = pc.order_id
        WHERE pc.total_with_vat = 0
    LOOP
        -- Calculate totals from order_items for this order
        SELECT 
            COALESCE(SUM(oi.subtotal), 0),
            COALESCE(SUM(oi.vat_amount), 0),
            COALESCE(SUM(oi.total_amount), 0)
        INTO order_subtotal, order_vat_total, order_total
        FROM order_items oi
        WHERE oi.order_id = rec.order_id;
        
        -- If no items, use estimated_cost
        IF order_total = 0 THEN
            order_total := COALESCE(rec.estimated_cost, 0);
            order_subtotal := ROUND(order_total / 1.16, 2);
            order_vat_total := order_total - order_subtotal;
        END IF;
        
        -- Update the pending collection with correct totals
        UPDATE pending_collections 
        SET 
            estimated_cost = order_total,
            total_vat_amount = order_vat_total,
            subtotal_without_vat = order_subtotal,
            total_with_vat = order_total,
            remaining_balance = GREATEST(order_total - COALESCE(total_paid, 0), 0),
            updated_at = now()
        WHERE id = rec.pc_id;
        
        RAISE LOG 'Fixed pending collection for order % with total %', rec.order_id, order_total;
    END LOOP;
END $$;