-- Fix the convert_quote_to_order function to use correct column name (total_amount instead of total)
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(quote_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quote RECORD;
    v_order_id UUID;
    v_order_number TEXT;
    v_item RECORD;
    v_existing_order RECORD;
BEGIN
    -- Get the quote
    SELECT * INTO v_quote FROM quotes WHERE id = quote_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Quote not found');
    END IF;
    
    -- Check if order already exists for this quote
    SELECT id, order_number INTO v_existing_order FROM orders WHERE quote_id = convert_quote_to_order.quote_id;
    
    IF FOUND THEN
        -- Update quote status to accepted
        UPDATE quotes SET status = 'aceptada' WHERE id = quote_id;
        RETURN json_build_object('success', true, 'existing', true, 'order_id', v_existing_order.id, 'order_number', v_existing_order.order_number, 'message', 'Order already exists for this quote');
    END IF;
    
    -- Generate order number
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
    
    -- Create the order - orders accepted by client go directly to 'en_proceso'
    INSERT INTO orders (
        id,
        order_number,
        client_id,
        quote_id,
        status,
        priority,
        client_approval,
        total_amount,
        balance,
        source_type,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_order_number,
        v_quote.client_id,
        quote_id,
        'en_proceso'::order_status,
        'normal'::order_priority,
        true,
        v_quote.total_amount,
        v_quote.total_amount,
        'quote',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_order_id;
    
    -- Copy quote items to order items
    FOR v_item IN 
        SELECT 
            qi.*,
            st.item_type as service_item_type,
            st.cost_price,
            st.base_price
        FROM quote_items qi
        LEFT JOIN service_types st ON st.id = qi.service_type_id
        WHERE qi.quote_id = convert_quote_to_order.quote_id
    LOOP
        INSERT INTO order_items (
            id,
            order_id,
            service_type_id,
            service_name,
            service_description,
            quantity,
            unit_cost_price,
            unit_base_price,
            profit_margin_rate,
            subtotal,
            vat_rate,
            vat_amount,
            total_amount,
            item_type,
            created_at,
            updated_at,
            status
        ) VALUES (
            gen_random_uuid(),
            v_order_id,
            v_item.service_type_id,
            v_item.name,
            v_item.description,
            v_item.quantity,
            COALESCE(v_item.cost_price, 0),
            v_item.unit_price,
            COALESCE(v_item.profit_margin_rate, 30),
            v_item.subtotal * v_item.quantity,
            v_item.vat_rate,
            v_item.vat_amount * v_item.quantity,
            v_item.total * v_item.quantity,
            COALESCE(v_item.service_item_type, 'servicio'),
            NOW(),
            NOW(),
            'pending'::order_item_status
        );
    END LOOP;
    
    -- Update quote status
    UPDATE quotes SET status = 'aceptada' WHERE id = quote_id;
    
    -- Log the status change
    INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, notes)
    VALUES (v_order_id, 'en_proceso', 'en_proceso', NULL, 'Orden creada desde cotización aceptada por cliente');
    
    RETURN json_build_object('success', true, 'order_id', v_order_id, 'order_number', v_order_number);
END;
$$;