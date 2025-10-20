-- ============================================================================
-- CRITICAL SECURITY FIX: User Roles System
-- ============================================================================

-- 1. Create user_roles table with proper structure
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create secure has_role function with fixed search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. Migrate existing role data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role
FROM public.profiles
WHERE user_id IS NOT NULL AND role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Update get_current_user_role to use user_roles table with fixed search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role::text, 'cliente'::text)
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 5. Update get_user_role_safe to use user_roles table with fixed search_path
CREATE OR REPLACE FUNCTION public.get_user_role_safe()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role::text, 'cliente'::text)
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 6. Update get_simple_user_role to use user_roles table with fixed search_path
CREATE OR REPLACE FUNCTION public.get_simple_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role::text, 'cliente'::text)
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================================
-- FIX: Profiles Table RLS Policies - Restrict Public Access
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policies
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Supervisors can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'::user_role));

-- ============================================================================
-- FIX: Clients Table RLS - Restrict to Need-to-Know Basis
-- ============================================================================

-- Drop overly broad staff access policy
DROP POLICY IF EXISTS "Staff can manage clients" ON public.clients;

-- Create granular policies
CREATE POLICY "Admins full access to clients"
ON public.clients
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Supervisors can view and manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'supervisor'::user_role));

CREATE POLICY "Sales can view and create clients"
ON public.clients
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'vendedor'::user_role));

CREATE POLICY "Sales can insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'vendedor'::user_role));

CREATE POLICY "Technicians view assigned clients only"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'tecnico'::user_role)
  AND id IN (
    SELECT client_id FROM public.orders
    WHERE assigned_technician = auth.uid()
  )
);

-- ============================================================================
-- FIX: Fiscal Withdrawals - Restrict to Admin and Supervisor Only
-- ============================================================================

-- Drop overly broad policy
DROP POLICY IF EXISTS "Staff can view fiscal withdrawals" ON public.fiscal_withdrawals;

-- Create restrictive policy
CREATE POLICY "Only admins and supervisors view fiscal withdrawals"
ON public.fiscal_withdrawals
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador'::user_role)
  OR public.has_role(auth.uid(), 'supervisor'::user_role)
);

CREATE POLICY "Only admins manage fiscal withdrawals"
ON public.fiscal_withdrawals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'administrador'::user_role));

-- ============================================================================
-- FIX: General Chats - Restrict to Participants Only
-- ============================================================================

-- Drop overly broad policy if exists
DROP POLICY IF EXISTS "Staff and clients can view general chats" ON public.general_chats;

-- Create restrictive policies for chat participants only
CREATE POLICY "Users view chats they sent"
ON public.general_chats
FOR SELECT
TO authenticated
USING (sender_id = auth.uid());

CREATE POLICY "Admins and supervisors view all chats"
ON public.general_chats
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador'::user_role)
  OR public.has_role(auth.uid(), 'supervisor'::user_role)
);

-- ============================================================================
-- FIX: User Roles Table RLS Policies
-- ============================================================================

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'administrador'::user_role));

-- ============================================================================
-- Update handle_new_user trigger to use user_roles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (user_id, email, username, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'cliente'::user_role)
  );

  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'cliente'::user_role)
  );

  RETURN NEW;
END;
$$;