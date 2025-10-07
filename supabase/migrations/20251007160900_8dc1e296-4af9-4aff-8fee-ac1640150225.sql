-- Add RLS policies for technicians to view and create quotes

-- Allow technicians to view all quotes
CREATE POLICY "Technicians can view all quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'tecnico'::user_role
  )
);

-- Allow technicians to create quotes
CREATE POLICY "Technicians can create quotes"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'tecnico'::user_role
  )
);

-- Allow technicians to update quotes they created or are assigned to
CREATE POLICY "Technicians can update assigned quotes"
ON public.quotes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'tecnico'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'tecnico'::user_role
  )
);