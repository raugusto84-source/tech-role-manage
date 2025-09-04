-- Add serial number and supplier name fields to order_items
ALTER TABLE public.order_items 
ADD COLUMN serial_number text,
ADD COLUMN supplier_name text;

-- Create index for efficient serial number searches
CREATE INDEX idx_order_items_serial_number ON public.order_items(serial_number) 
WHERE serial_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.order_items.serial_number IS 'Serial number of the product/article if applicable';
COMMENT ON COLUMN public.order_items.supplier_name IS 'Name of the supplier where the product was purchased';