-- Create pending_collections table for orders approved by clients
CREATE TABLE public.pending_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_collections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can manage pending collections" 
ON public.pending_collections 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]));

-- Create function to generate pending collection when order is approved
CREATE OR REPLACE FUNCTION public.create_pending_collection_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create when client_approval changes to true
  IF NEW.client_approval = true AND (OLD.client_approval IS NULL OR OLD.client_approval = false) THEN
    -- Get client info
    INSERT INTO public.pending_collections (
      order_id,
      order_number,
      client_name,
      client_email,
      amount
    )
    SELECT 
      NEW.id,
      NEW.order_number,
      c.name,
      c.email,
      COALESCE(NEW.estimated_cost, 0)
    FROM public.clients c
    WHERE c.id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger
CREATE TRIGGER create_pending_collection_on_order_approval
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pending_collection_on_approval();