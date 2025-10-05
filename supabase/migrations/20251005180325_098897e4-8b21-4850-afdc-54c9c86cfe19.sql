-- Add day_of_week column to scheduled_services table
ALTER TABLE scheduled_services 
ADD COLUMN IF NOT EXISTS day_of_week INTEGER;

COMMENT ON COLUMN scheduled_services.day_of_week IS 'Day of week for weekly frequencies (0=Sunday, 1=Monday, etc.)';
