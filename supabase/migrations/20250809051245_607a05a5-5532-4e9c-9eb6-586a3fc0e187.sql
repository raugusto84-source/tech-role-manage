-- Add assignment reason field to orders table
ALTER TABLE public.orders 
ADD COLUMN assignment_reason text;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.assignment_reason IS 'Reason why this specific technician was assigned to the order';