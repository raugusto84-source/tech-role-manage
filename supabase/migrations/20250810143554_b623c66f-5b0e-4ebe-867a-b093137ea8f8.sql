-- CRITICAL SECURITY FIXES
-- Fix 1: Prevent privilege escalation in profiles table
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create separate policies for profile updates vs role changes
CREATE POLICY "Users can update their own profile data" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (
  user_id = auth.uid() AND 
  -- Prevent role changes by non-admins
  (OLD.role = NEW.role OR get_current_user_role() = 'administrador')
);

-- Admin-only policy for role management
CREATE POLICY "Admins can update any profile role" 
ON public.profiles 
FOR UPDATE 
USING (get_current_user_role() = 'administrador') 
WITH CHECK (get_current_user_role() = 'administrador');

-- Fix 2: Restrict client data access based on roles and email matching
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

-- Clients can only see their own data through email matching
CREATE POLICY "Clients can view their own data" 
ON public.clients 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente' AND email = (
    SELECT profiles.email FROM public.profiles WHERE profiles.user_id = auth.uid()
  )) OR
  get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text])
);

-- Fix 3: Add validation to public insertion policies
DROP POLICY IF EXISTS "Clients can create order requests" ON public.order_requests;

-- Add proper validation for order requests
CREATE POLICY "Validated order requests creation" 
ON public.order_requests 
FOR INSERT 
WITH CHECK (
  -- Ensure required fields are present and valid
  client_name IS NOT NULL AND trim(client_name) != '' AND
  client_email IS NOT NULL AND trim(client_email) != '' AND
  client_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
  failure_description IS NOT NULL AND trim(failure_description) != '' AND
  service_description IS NOT NULL AND trim(service_description) != '' AND
  client_address IS NOT NULL AND trim(client_address) != ''
);

DROP POLICY IF EXISTS "Anyone can insert diagnostics" ON public.client_diagnostics;

-- Add validation for diagnostic insertions
CREATE POLICY "Validated diagnostic insertion" 
ON public.client_diagnostics 
FOR INSERT 
WITH CHECK (
  -- Ensure required fields are present and valid
  question_text IS NOT NULL AND trim(question_text) != '' AND
  answer IS NOT NULL AND trim(answer) != '' AND
  service_type_id IS NOT NULL AND
  -- Validate email format if provided
  (client_email IS NULL OR client_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Fix 4: Add role change audit logging
CREATE TABLE IF NOT EXISTS public.profile_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  old_role user_role,
  new_role user_role NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT
);

-- Enable RLS on audit table
ALTER TABLE public.profile_role_changes ENABLE ROW LEVEL SECURITY;

-- Only admins can view role change logs
CREATE POLICY "Admins can view role changes" 
ON public.profile_role_changes 
FOR SELECT 
USING (get_current_user_role() = 'administrador');

-- Create trigger function to log role changes
CREATE OR REPLACE FUNCTION public.log_profile_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if role actually changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.profile_role_changes (
      user_id, 
      old_role, 
      new_role, 
      changed_by,
      reason
    ) VALUES (
      NEW.user_id,
      OLD.role,
      NEW.role,
      auth.uid(),
      'Role changed via profile update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role change logging
DROP TRIGGER IF EXISTS profile_role_change_audit ON public.profiles;
CREATE TRIGGER profile_role_change_audit
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_role_changes();

-- Fix 5: Strengthen data access controls for sensitive tables
-- Update order_items policy to be more restrictive
DROP POLICY IF EXISTS "Users can view order items for their orders" ON public.order_items;

CREATE POLICY "Restricted order items access" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    LEFT JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE o.id = order_items.order_id AND (
      -- Technician assigned to order
      o.assigned_technician = auth.uid() OR
      -- Admin access
      p.role = 'administrador'::user_role OR
      -- Sales team access
      p.role = 'vendedor'::user_role OR
      -- Client can see their own order items only
      (p.role = 'cliente'::user_role AND c.email = p.email)
    )
  )
);

-- Add input length limits to prevent potential DoS attacks
ALTER TABLE public.order_requests 
ADD CONSTRAINT order_requests_client_name_length CHECK (length(client_name) <= 100),
ADD CONSTRAINT order_requests_client_email_length CHECK (length(client_email) <= 100),
ADD CONSTRAINT order_requests_failure_desc_length CHECK (length(failure_description) <= 2000),
ADD CONSTRAINT order_requests_service_desc_length CHECK (length(service_description) <= 1000),
ADD CONSTRAINT order_requests_address_length CHECK (length(client_address) <= 500);

ALTER TABLE public.client_diagnostics
ADD CONSTRAINT client_diagnostics_question_length CHECK (length(question_text) <= 500),
ADD CONSTRAINT client_diagnostics_answer_length CHECK (length(answer) <= 2000),
ADD CONSTRAINT client_diagnostics_email_length CHECK (length(client_email) <= 100);

-- Fix 6: Remove overly broad permissions and add granular controls
-- Update attendance records policy to be more restrictive
DROP POLICY IF EXISTS "Users can update their own attendance" ON public.attendance_records;

CREATE POLICY "Users can update their own attendance with restrictions" 
ON public.attendance_records 
FOR UPDATE 
USING (employee_id = auth.uid()) 
WITH CHECK (
  employee_id = auth.uid() AND
  -- Prevent updating records older than 24 hours (except by admin)
  (created_at > now() - interval '24 hours' OR get_current_user_role() = 'administrador')
);

-- Add more restrictive policy for chat room creation
DROP POLICY IF EXISTS "Users can create chat rooms" ON public.chat_rooms;

CREATE POLICY "Validated chat room creation" 
ON public.chat_rooms 
FOR INSERT 
WITH CHECK (
  client_id = auth.uid() AND
  room_type IS NOT NULL AND
  related_id IS NOT NULL AND
  -- Validate room_type is within allowed values
  room_type IN ('order', 'quote', 'support', 'general')
);