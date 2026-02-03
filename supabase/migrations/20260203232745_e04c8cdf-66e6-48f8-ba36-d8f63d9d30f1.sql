-- Drop and recreate the function - changed_by cannot be NULL
DROP FUNCTION IF EXISTS public.create_missing_orders_for_accepted_quotes();

CREATE OR REPLACE FUNCTION public.create_missing_orders_for_accepted_quotes()
RETURNS TABLE(quote_number TEXT, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quote RECORD;
    v_order_id UUID;
    v_order_number TEXT;
    v_item RECORD;
BEGIN
    -- Loop through each accepted quote without an order
    FOR v_quote IN 
        SELECT q.id, q.quote_number, q.estimated_amount, q.created_by, q.department, q.service_description
        FROM quotes q
        WHERE q.status = 'aceptada'
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.quote_id = q.id)
    LOOP
        -- Generate order number
        v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
        
        -- Create the order with all required fields
        INSERT INTO orders (
            id, order_number, quote_id, status, priority, client_approval,
            source_type, created_at, updated_at, created_by, failure_description,
            service_category, order_category, delivery_date
        ) VALUES (
            gen_random_uuid(),
            v_order_number,
            v_quote.id,
            'en_proceso',
            'media',
            true,
            'quote',
            NOW(),
            NOW(),
            v_quote.created_by,
            COALESCE(v_quote.service_description, 'Orden desde cotización ' || v_quote.quote_number),
            COALESCE(v_quote.department, 'sistemas'),
            COALESCE(v_quote.department, 'sistemas'),
            (NOW() + INTERVAL '7 days')::date
        )
        RETURNING id INTO v_order_id;
        
        -- Copy quote items to order items
        FOR v_item IN 
            SELECT qi.*, st.item_type as service_item_type, st.cost_price
            FROM quote_items qi
            LEFT JOIN service_types st ON st.id = qi.service_type_id
            WHERE qi.quote_id = v_quote.id
        LOOP
            INSERT INTO order_items (
                id, order_id, service_type_id, service_name, service_description,
                quantity, unit_cost_price, unit_base_price, profit_margin_rate,
                subtotal, vat_rate, vat_amount, total_amount, item_type,
                created_at, updated_at, status
            ) VALUES (
                gen_random_uuid(),
                v_order_id,
                v_item.service_type_id,
                v_item.name,
                v_item.description,
                v_item.quantity,
                COALESCE(v_item.cost_price, 0),
                v_item.unit_price,
                30,
                v_item.subtotal,
                v_item.vat_rate,
                v_item.vat_amount,
                v_item.total,
                COALESCE(v_item.service_item_type, 'servicio'),
                NOW(),
                NOW(),
                'pendiente'
            );
        END LOOP;
        
        -- Log the status change - use created_by from quote as changed_by cannot be null
        INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, notes)
        VALUES (v_order_id, 'en_proceso', 'en_proceso', v_quote.created_by, 'Orden creada desde cotización ' || v_quote.quote_number);
        
        -- Return the created mapping
        quote_number := v_quote.quote_number;
        order_number := v_order_number;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Execute the function to create missing orders
SELECT * FROM public.create_missing_orders_for_accepted_quotes();