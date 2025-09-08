-- Update reward settings to use 2% for both new and general clients
UPDATE public.reward_settings 
SET new_client_cashback_percent = 2.0
WHERE is_active = true;