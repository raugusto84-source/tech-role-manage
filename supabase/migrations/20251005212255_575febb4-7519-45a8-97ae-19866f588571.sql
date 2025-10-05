-- Drop existing problematic SELECT policies for clients
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view their own record" ON public.clients;

-- Create a single comprehensive SELECT policy that covers all cases
CREATE POLICY "Users can view relevant clients" ON public.clients
FOR SELECT
USING (
  -- Staff (admin, vendedor, supervisor, tecnico) can view all clients
  (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]))
  OR
  -- Clients can view their own record
  ((get_current_user_role() = 'cliente'::text) AND (email = (SELECT email FROM profiles WHERE user_id = auth.uid())))
);