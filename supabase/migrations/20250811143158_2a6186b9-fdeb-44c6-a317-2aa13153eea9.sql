-- Temporarily disable problematic triggers on orders table to isolate the issue
DROP TRIGGER IF EXISTS trg_orders_status_log ON orders;
DROP TRIGGER IF EXISTS handle_client_approval ON orders;
DROP TRIGGER IF EXISTS trg_orders_debug_update ON orders;
DROP TRIGGER IF EXISTS debug_order_update_trigger ON orders;