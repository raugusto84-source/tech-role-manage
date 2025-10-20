-- Fix infinite recursion in clients RLS policy
-- The problem: technician policy queries orders, but orders queries clients

-- Drop the problematic policy
DROP POLICY IF EXISTS "Technicians view assigned clients only" ON public.clients;

-- Create a security definer function to check if technician has access to client
CREATE OR REPLACE FUNCTION public.technician_has_client_access(_technician_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE assigned_technician = _technician_id
    AND client_id = _client_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Technicians view assigned clients only"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'tecnico'::user_role)
  AND public.technician_has_client_access(auth.uid(), id)
);