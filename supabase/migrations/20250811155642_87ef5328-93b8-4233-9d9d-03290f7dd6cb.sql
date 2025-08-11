-- Add user_id column to clients table to link authenticated users to client records
ALTER TABLE public.clients 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_clients_user_id ON public.clients(user_id);

-- Update existing clients with matching emails to link them to users
UPDATE public.clients 
SET user_id = profiles.user_id
FROM public.profiles 
WHERE public.clients.email = profiles.email 
AND profiles.role = 'cliente';

-- Create policy to allow clients to view their own record by user_id
CREATE POLICY "clients_view_own_by_user_id" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update the existing order viewing policy to use user_id relationship
DROP POLICY IF EXISTS "clients_view_own" ON public.orders;

CREATE POLICY "clients_view_own_updated" 
ON public.orders 
FOR SELECT 
USING (
  (get_user_role_safe() = 'cliente'::text AND client_id IN (
    SELECT c.id FROM clients c WHERE c.user_id = auth.uid()
  )) OR 
  (get_user_role_safe() = 'administrador'::text) OR 
  (get_user_role_safe() = 'vendedor'::text) OR 
  ((get_user_role_safe() = 'tecnico'::text) AND (assigned_technician = auth.uid()))
);