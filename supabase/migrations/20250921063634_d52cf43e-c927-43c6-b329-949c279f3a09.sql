-- Initialize missing client_rewards records and set them as validated for cashback eligibility
INSERT INTO public.client_rewards (
  client_id, 
  total_points, 
  total_cashback, 
  is_new_client, 
  new_client_discount_used,
  email_validated,
  whatsapp_validated,
  registration_source,
  policy_client
)
SELECT 
  c.id,
  0,
  0,
  true,
  false,
  true,  -- Mark as email validated
  true,  -- Mark as whatsapp validated  
  'www.login.syslag.com',  -- Set required registration source
  false
FROM clients c
LEFT JOIN client_rewards cr ON cr.client_id = c.id
WHERE cr.id IS NULL
ON CONFLICT (client_id) DO UPDATE SET
  email_validated = true,
  whatsapp_validated = true,
  registration_source = 'www.login.syslag.com',
  updated_at = now();