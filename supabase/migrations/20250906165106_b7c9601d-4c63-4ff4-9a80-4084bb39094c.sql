-- Add missing order_id column to pending_collections table
ALTER TABLE public.pending_collections 
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id);

-- Add missing main_category_id column to service_types table  
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS main_category_id uuid REFERENCES public.main_service_categories(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_pending_collections_order_id ON public.pending_collections(order_id);
CREATE INDEX IF NOT EXISTS idx_service_types_main_category_id ON public.service_types(main_category_id);