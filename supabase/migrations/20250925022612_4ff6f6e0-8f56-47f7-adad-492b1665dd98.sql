-- Add created_by field to policy_clients table to match expected schema
ALTER TABLE public.policy_clients 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update RLS policies to allow vendedores to insert and update policy_clients
DROP POLICY IF EXISTS "Admins can manage policy clients" ON public.policy_clients;

CREATE POLICY "Staff can manage policy clients"
ON public.policy_clients
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));