-- Add user_id column to quotes table to link authenticated users to quotes
ALTER TABLE public.quotes 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_quotes_user_id ON public.quotes(user_id);

-- Update existing quotes to link them to users via client_email match
UPDATE public.quotes 
SET user_id = profiles.user_id
FROM public.profiles 
WHERE public.quotes.client_email = profiles.email 
AND profiles.role = 'cliente';

-- Create policy to allow clients to view their own quotes by user_id
CREATE POLICY "clients_view_own_quotes_by_user_id" 
ON public.quotes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update quotes insertion policy to use user_id
CREATE POLICY "clients_can_create_quotes_by_user_id" 
ON public.quotes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR get_user_role_safe() = ANY(ARRAY['administrador', 'vendedor']));