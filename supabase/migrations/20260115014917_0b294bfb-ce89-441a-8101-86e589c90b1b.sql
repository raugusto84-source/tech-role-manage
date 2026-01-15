-- Drop existing constraint and create a new one that includes fraccionamientos
ALTER TABLE public.fleet_groups 
DROP CONSTRAINT IF EXISTS fleet_groups_category_check;

ALTER TABLE public.fleet_groups 
ADD CONSTRAINT fleet_groups_category_check 
CHECK (category = ANY (ARRAY['sistemas'::text, 'seguridad'::text, 'fraccionamientos'::text]));

-- Create Fraccionamientos fleet group
INSERT INTO public.fleet_groups (name, description, category, is_active)
VALUES ('Flotilla Fraccionamientos', 'Flotilla para servicios de fraccionamientos y desarrollos de acceso', 'fraccionamientos', true);

-- Update orders table order_category constraint to allow fraccionamientos if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'orders'::regclass 
    AND conname = 'orders_order_category_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_order_category_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_category_check 
    CHECK (order_category = ANY (ARRAY['sistemas'::text, 'seguridad'::text, 'fraccionamientos'::text]));
  END IF;
END $$;

-- Update existing orders to set order_category based on service_category
UPDATE public.orders 
SET order_category = service_category 
WHERE service_category IS NOT NULL 
  AND (order_category IS NULL OR order_category != service_category);