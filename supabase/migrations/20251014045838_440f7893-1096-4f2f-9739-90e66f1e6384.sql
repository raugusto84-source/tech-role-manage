-- Enable RLS on pending_collections if not already enabled
ALTER TABLE public.pending_collections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can view pending collections" ON public.pending_collections;
DROP POLICY IF EXISTS "Staff can manage pending collections" ON public.pending_collections;

-- Allow staff to view pending collections
CREATE POLICY "Staff can view pending collections"
ON public.pending_collections
FOR SELECT
USING (
  get_current_user_role() IN ('administrador', 'supervisor', 'vendedor', 'tecnico')
);

-- Allow staff to manage pending collections  
CREATE POLICY "Staff can manage pending collections"
ON public.pending_collections
FOR ALL
USING (
  get_current_user_role() IN ('administrador', 'supervisor', 'vendedor')
)
WITH CHECK (
  get_current_user_role() IN ('administrador', 'supervisor', 'vendedor')
);