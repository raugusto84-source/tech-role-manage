-- Add image_url field to order_chat_messages table
ALTER TABLE public.order_chat_messages 
ADD COLUMN image_url TEXT;

-- Add index for better performance when querying images
CREATE INDEX idx_order_chat_messages_image_url ON public.order_chat_messages(image_url) WHERE image_url IS NOT NULL;