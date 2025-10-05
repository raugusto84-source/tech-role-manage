-- Add checklist fields to service_types table
ALTER TABLE service_types 
ADD COLUMN IF NOT EXISTS checklist_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN service_types.checklist_enabled IS 'Enable/disable checklist for this service';
COMMENT ON COLUMN service_types.checklist_items IS 'Array of checklist items: [{"id": "uuid", "title": "text", "description": "text", "order": 1}]';

-- Create table for tracking checklist progress per order item
CREATE TABLE IF NOT EXISTS order_checklist_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  checklist_item_id TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES profiles(user_id),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(order_item_id, checklist_item_id)
);

-- Enable RLS
ALTER TABLE order_checklist_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_checklist_progress
CREATE POLICY "Staff can manage checklist progress"
ON order_checklist_progress
FOR ALL
TO authenticated
USING (
  get_current_user_role() IN ('administrador', 'tecnico', 'vendedor')
)
WITH CHECK (
  get_current_user_role() IN ('administrador', 'tecnico', 'vendedor')
);

CREATE POLICY "Clients can view checklist progress for their orders"
ON order_checklist_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN clients c ON c.id = o.client_id
    JOIN profiles p ON p.email = c.email
    WHERE oi.id = order_checklist_progress.order_item_id
    AND p.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_checklist_progress_order_item 
ON order_checklist_progress(order_item_id);

CREATE INDEX IF NOT EXISTS idx_order_checklist_progress_completed 
ON order_checklist_progress(is_completed);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_order_checklist_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_checklist_progress_updated_at
BEFORE UPDATE ON order_checklist_progress
FOR EACH ROW
EXECUTE FUNCTION update_order_checklist_progress_updated_at();