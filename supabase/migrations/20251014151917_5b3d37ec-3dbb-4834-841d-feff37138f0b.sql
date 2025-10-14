-- Add twilio_sid column to whatsapp_notifications table
ALTER TABLE public.whatsapp_notifications 
ADD COLUMN IF NOT EXISTS twilio_sid text;

-- Add index for faster lookups by Twilio SID
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_twilio_sid 
ON public.whatsapp_notifications(twilio_sid);

-- Add comment
COMMENT ON COLUMN public.whatsapp_notifications.twilio_sid IS 'Twilio message SID for tracking message status';