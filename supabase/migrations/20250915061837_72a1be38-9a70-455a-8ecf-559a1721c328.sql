-- Fix the pending collection trigger function
CREATE OR REPLACE FUNCTION public.create_pending_collection_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create when client_approval changes to true
  IF NEW.client_approval = true AND (OLD.client_approval IS NULL OR OLD.client_approval = false) THEN
    -- Get client info and create pending collection
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
      GREATEST(COALESCE(NEW.estimated_cost, 0), 0) -- Ensure non-negative amount
    FROM public.clients c
    WHERE c.id = NEW.client_id
    AND NEW.client_id IS NOT NULL; -- Only if client exists
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Also fix the pricing calculation issue for services without base price
-- Update services that have 0 or null cost_price to have a proper base price
UPDATE public.service_types 
SET 
  cost_price = COALESCE(base_price, 500),  -- Set reasonable default cost
  base_price = GREATEST(COALESCE(base_price, 500), 500) -- Ensure minimum price
WHERE (cost_price = 0 OR cost_price IS NULL OR base_price = 0 OR base_price IS NULL)
AND name ILIKE '%formateo%';