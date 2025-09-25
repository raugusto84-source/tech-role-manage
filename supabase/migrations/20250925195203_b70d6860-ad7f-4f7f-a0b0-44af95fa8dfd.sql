-- Add policy-related columns to existing pending_collections table
ALTER TABLE public.pending_collections 
ADD COLUMN policy_client_id UUID REFERENCES public.policy_clients(id) ON DELETE CASCADE,
ADD COLUMN policy_name TEXT,
ADD COLUMN collection_type TEXT NOT NULL DEFAULT 'order_payment', -- 'policy_payment' or 'order_payment'
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'collected', 'overdue', 'cancelled'
ADD COLUMN due_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN notes TEXT,
ADD COLUMN created_by UUID,
ADD COLUMN collected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN collected_by UUID;

-- Add constraint to ensure either order_id or policy_client_id is set
ALTER TABLE public.pending_collections 
ADD CONSTRAINT check_collection_reference CHECK (
  (policy_client_id IS NOT NULL AND order_id IS NULL) OR 
  (policy_client_id IS NULL AND order_id IS NOT NULL)
);

-- Make order_id nullable since we now support policy collections too
ALTER TABLE public.pending_collections 
ALTER COLUMN order_id DROP NOT NULL,
ALTER COLUMN order_number DROP NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pending_collections_policy_client_id ON public.pending_collections(policy_client_id);
CREATE INDEX IF NOT EXISTS idx_pending_collections_status ON public.pending_collections(status);
CREATE INDEX IF NOT EXISTS idx_pending_collections_due_date ON public.pending_collections(due_date);
CREATE INDEX IF NOT EXISTS idx_pending_collections_collection_type ON public.pending_collections(collection_type);