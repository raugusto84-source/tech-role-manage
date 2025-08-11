-- Remove the remaining problematic trigger that's causing the enum error
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON orders;