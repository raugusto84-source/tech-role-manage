-- Fix double cashback on order completion by removing legacy trigger and ensuring single rewards trigger
BEGIN;

-- Drop the legacy trigger that was still active (wrong name used in prior migration)
DROP TRIGGER IF EXISTS process_order_rewards_trigger ON public.orders;

-- Ensure only the updated rewards trigger exists and points to the correct function
DROP TRIGGER IF EXISTS process_updated_order_rewards ON public.orders;
CREATE TRIGGER process_updated_order_rewards
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_updated_order_rewards();

COMMIT;