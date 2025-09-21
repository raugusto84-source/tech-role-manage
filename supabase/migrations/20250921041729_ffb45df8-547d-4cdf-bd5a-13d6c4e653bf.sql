-- Create client_rewards records for existing clients who don't have them
INSERT INTO public.client_rewards (client_id, total_cashback, is_new_client, new_client_discount_used)
SELECT 
  c.id,
  COALESCE(
    (SELECT SUM(rt.amount) 
     FROM reward_transactions rt 
     WHERE rt.client_id = c.id 
     AND rt.transaction_type = 'earned' 
     AND (rt.expires_at IS NULL OR rt.expires_at > NOW())), 
    0
  ) as total_cashback,
  true as is_new_client,
  false as new_client_discount_used
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM client_rewards cr WHERE cr.client_id = c.id
);

-- Update existing total_cashback for any existing records to match transaction totals
UPDATE public.client_rewards 
SET total_cashback = COALESCE(
  (SELECT SUM(rt.amount) 
   FROM reward_transactions rt 
   WHERE rt.client_id = client_rewards.client_id 
   AND rt.transaction_type = 'earned' 
   AND (rt.expires_at IS NULL OR rt.expires_at > NOW())), 
  0
),
updated_at = NOW();