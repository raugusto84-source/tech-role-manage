-- Update RLS policies for clients table to ensure staff can see all clients

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "clients_view_own_by_user_id" ON public.clients;

-- Create comprehensive policy for staff to view all clients
CREATE POLICY "Staff can view all clients"
ON public.clients FOR SELECT
USING (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text])
);

-- Allow clients to view their own records by email match
CREATE POLICY "Clients can view their own record"
ON public.clients FOR SELECT
USING (
  get_current_user_role() = 'cliente'::text 
  AND email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);

-- Allow authenticated users to create client records (for staff creating clients)
CREATE POLICY "Authenticated users can create clients"
ON public.clients FOR INSERT
WITH CHECK (
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text])
  OR auth.uid() = user_id  -- Allow self-creation
);