-- Add new columns for weekly frequency configuration
ALTER TABLE policy_service_configurations 
ADD COLUMN frequency_weeks INTEGER DEFAULT 1,
ADD COLUMN day_of_week INTEGER DEFAULT 1; -- 1 = Monday, 7 = Sunday

-- Update existing records to use weekly frequency (convert days to weeks approximately)
UPDATE policy_service_configurations 
SET frequency_weeks = CASE 
  WHEN frequency_days <= 7 THEN 1
  WHEN frequency_days <= 14 THEN 2
  WHEN frequency_days <= 21 THEN 3
  ELSE 4
END
WHERE frequency_weeks IS NULL;

-- Add comments for clarity
COMMENT ON COLUMN policy_service_configurations.frequency_weeks IS 'Frequency in weeks (1 = every week, 2 = every 2 weeks, etc.)';
COMMENT ON COLUMN policy_service_configurations.day_of_week IS 'Day of week (1 = Monday, 7 = Sunday)';