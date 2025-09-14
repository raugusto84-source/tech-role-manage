-- Fix order_history check constraint to allow status change events
ALTER TABLE public.order_history 
DROP CONSTRAINT IF EXISTS order_history_event_type_check;

-- Add updated constraint that includes all possible event types
ALTER TABLE public.order_history 
ADD CONSTRAINT order_history_event_type_check 
CHECK (event_type = ANY (ARRAY[
  'created', 
  'authorized', 
  'completed', 
  'signed', 
  'deleted', 
  'restored',
  'status_changed',
  'assigned',
  'modified',
  'approved'
]));