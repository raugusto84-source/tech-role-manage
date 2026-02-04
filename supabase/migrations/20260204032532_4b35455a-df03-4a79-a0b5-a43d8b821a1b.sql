-- Fix existing order_items that came from quotes with incorrect totals
-- This updates subtotal, vat_amount, total_amount and metadata from quote_items and service_types

DO $$
DECLARE
  v_order_item RECORD;
  v_quote_item RECORD;
  v_service_type RECORD;
  v_correct_margin NUMERIC;
  v_updated_count INTEGER := 0;
BEGIN
  -- Loop through all order_items from orders that have quote_id
  FOR v_order_item IN 
    SELECT oi.*, o.quote_id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.quote_id IS NOT NULL
  LOOP
    -- Find matching quote_item by name and quantity
    SELECT * INTO v_quote_item
    FROM quote_items qi
    WHERE qi.quote_id = v_order_item.quote_id
      AND qi.name = v_order_item.service_name
      AND qi.quantity = v_order_item.quantity
    LIMIT 1;
    
    IF FOUND THEN
      -- Get service_type data if available
      SELECT * INTO v_service_type
      FROM service_types st
      WHERE st.id = v_quote_item.service_type_id;
      
      -- Calculate margin from tiers
      v_correct_margin := 0;
      IF v_service_type.profit_margin_tiers IS NOT NULL THEN
        SELECT (tier->>'margin')::numeric INTO v_correct_margin
        FROM jsonb_array_elements(v_service_type.profit_margin_tiers::jsonb) AS tier
        LIMIT 1;
      END IF;
      
      -- Update the order_item with correct values
      UPDATE order_items
      SET 
        subtotal = v_quote_item.subtotal,
        vat_amount = v_quote_item.vat_amount,
        total_amount = v_quote_item.total,
        unit_cost_price = COALESCE(v_service_type.cost_price, v_quote_item.unit_price),
        unit_base_price = CASE 
          WHEN COALESCE(v_service_type.item_type, 'servicio') = 'servicio' 
          THEN COALESCE(v_service_type.base_price, v_quote_item.unit_price)
          ELSE COALESCE(v_service_type.cost_price, v_quote_item.unit_price)
        END,
        profit_margin_rate = COALESCE(v_correct_margin, 0),
        item_type = COALESCE(v_service_type.item_type, CASE WHEN v_quote_item.is_custom THEN 'articulo' ELSE 'servicio' END),
        pricing_locked = true,
        updated_at = now()
      WHERE id = v_order_item.id;
      
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Updated % order items', v_updated_count;
END $$;

-- Also update the orders.estimated_cost to match quote.estimated_amount
UPDATE orders o
SET estimated_cost = q.estimated_amount,
    updated_at = now()
FROM quotes q
WHERE o.quote_id = q.id
  AND o.quote_id IS NOT NULL
  AND (o.estimated_cost IS NULL OR o.estimated_cost != q.estimated_amount);