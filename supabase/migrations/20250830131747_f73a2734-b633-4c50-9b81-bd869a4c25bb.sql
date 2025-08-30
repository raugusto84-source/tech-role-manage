-- Fix RLS policies for pending_expenses table to allow proper DELETE operations

-- Drop existing policies
DROP POLICY IF EXISTS "Admin and supervisors can manage pending expenses" ON public.pending_expenses;

-- Create specific policies for better clarity
CREATE POLICY "Admins and supervisors can view pending expenses" 
ON public.pending_expenses 
FOR SELECT 
TO public 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Admins and supervisors can insert pending expenses" 
ON public.pending_expenses 
FOR INSERT 
TO public 
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Admins and supervisors can update pending expenses" 
ON public.pending_expenses 
FOR UPDATE 
TO public 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Admins and supervisors can delete pending expenses" 
ON public.pending_expenses 
FOR DELETE 
TO public 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));