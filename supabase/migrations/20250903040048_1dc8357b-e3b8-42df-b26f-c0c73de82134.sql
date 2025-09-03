-- Add client_id field to general_chats for independent client chats
ALTER TABLE public.general_chats 
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX idx_general_chats_client_id ON public.general_chats(client_id);

-- Add index for client_id + created_at for efficient querying
CREATE INDEX idx_general_chats_client_created_at ON public.general_chats(client_id, created_at);