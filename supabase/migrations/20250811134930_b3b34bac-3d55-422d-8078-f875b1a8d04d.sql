-- Add WhatsApp field to clients table
ALTER TABLE public.clients 
ADD COLUMN whatsapp TEXT;

-- Add WhatsApp field to profiles table for user profiles
ALTER TABLE public.profiles 
ADD COLUMN whatsapp TEXT;

-- Create notifications table to track sent messages
CREATE TABLE public.whatsapp_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  client_whatsapp TEXT NOT NULL,
  message_type TEXT NOT NULL, -- 'quote_requested', 'quote_accepted', 'quote_modified', 'order_created', 'order_modified', 'order_completed'
  related_id UUID NOT NULL, -- quote_id or order_id
  related_type TEXT NOT NULL, -- 'quote' or 'order'
  message_content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'pending'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on notifications table
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage all notifications
CREATE POLICY "Admins can manage all notifications" 
ON public.whatsapp_notifications 
FOR ALL 
USING (get_current_user_role() = 'administrador');

-- Policy for staff to view notifications
CREATE POLICY "Staff can view notifications" 
ON public.whatsapp_notifications 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor']));

-- Create function to send WhatsApp notification
CREATE OR REPLACE FUNCTION public.send_whatsapp_notification(
  p_client_email TEXT,
  p_message_type TEXT,
  p_related_id UUID,
  p_related_type TEXT,
  p_message_content TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  client_whatsapp TEXT;
BEGIN
  -- Get client WhatsApp number
  SELECT whatsapp INTO client_whatsapp
  FROM public.clients
  WHERE email = p_client_email AND whatsapp IS NOT NULL AND whatsapp != '';
  
  -- If no WhatsApp found, try profiles table
  IF client_whatsapp IS NULL THEN
    SELECT whatsapp INTO client_whatsapp
    FROM public.profiles
    WHERE email = p_client_email AND whatsapp IS NOT NULL AND whatsapp != '';
  END IF;
  
  -- Only proceed if we have a WhatsApp number
  IF client_whatsapp IS NOT NULL THEN
    -- Insert notification record
    INSERT INTO public.whatsapp_notifications (
      client_email,
      client_whatsapp,
      message_type,
      related_id,
      related_type,
      message_content
    ) VALUES (
      p_client_email,
      client_whatsapp,
      p_message_type,
      p_related_id,
      p_related_type,
      p_message_content
    );
    
    -- Here we would call the edge function to actually send the message
    -- For now, we just log it
    RAISE LOG 'WhatsApp notification queued for % (%) - Type: %, Message: %', 
      p_client_email, client_whatsapp, p_message_type, p_message_content;
  END IF;
END;
$$;