-- Add status field to order_items table to track individual service completion
ALTER TABLE public.order_items 
ADD COLUMN status order_status NOT NULL DEFAULT 'pendiente';

-- Add index for better performance when filtering by status
CREATE INDEX idx_order_items_status ON public.order_items(status);

-- Add index for order_id and status combination
CREATE INDEX idx_order_items_order_status ON public.order_items(order_id, status);

-- Update RLS policies to allow technicians to update order item status
CREATE POLICY "Technicians can update assigned order items" 
ON public.order_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND o.assigned_technician = auth.uid()
    AND get_current_user_role() = 'tecnico'
  )
);