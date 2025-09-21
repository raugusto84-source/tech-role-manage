-- Manually trigger reward processing for existing finalized orders that don't have rewards yet
-- This will simulate the trigger by temporarily changing and reverting the status

-- First, let's process rewards for orders without any reward transactions
DO $$
DECLARE
  order_record RECORD;
BEGIN
  FOR order_record IN 
    SELECT DISTINCT o.id, o.order_number, o.client_id, o.status
    FROM orders o
    WHERE o.status = 'finalizada' 
    AND NOT EXISTS (
      SELECT 1 FROM reward_transactions rt 
      WHERE rt.order_id = o.id 
      AND rt.transaction_type = 'earned'
    )
  LOOP
    -- Temporarily change status to trigger the reward processing
    UPDATE orders 
    SET status = 'en_proceso', updated_at = now()
    WHERE id = order_record.id;
    
    -- Change it back to finalizada to trigger the reward processing
    UPDATE orders 
    SET status = 'finalizada', updated_at = now()
    WHERE id = order_record.id;
    
    RAISE LOG 'Processed rewards for order: %', order_record.order_number;
  END LOOP;
END $$;