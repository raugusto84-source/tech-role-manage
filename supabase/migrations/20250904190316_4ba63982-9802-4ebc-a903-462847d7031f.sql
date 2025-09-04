-- Create table for purchase items with serial numbers
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC NOT NULL DEFAULT 0,
  warranty_months INTEGER DEFAULT 0,
  warranty_start_date DATE DEFAULT CURRENT_DATE,
  warranty_end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and supervisors can manage purchase items"
ON public.purchase_items
FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text]))
WITH CHECK (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Staff can view purchase items"
ON public.purchase_items
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text, 'vendedor'::text]));

-- Create index for serial number searches
CREATE INDEX idx_purchase_items_serial_number ON public.purchase_items(serial_number);
CREATE INDEX idx_purchase_items_expense_id ON public.purchase_items(expense_id);
CREATE INDEX idx_purchase_items_brand_model ON public.purchase_items(brand, model);

-- Create trigger to update warranty_end_date
CREATE OR REPLACE FUNCTION public.calculate_warranty_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.warranty_months > 0 AND NEW.warranty_start_date IS NOT NULL THEN
    NEW.warranty_end_date := NEW.warranty_start_date + INTERVAL '1 month' * NEW.warranty_months;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_purchase_item_warranty
BEFORE INSERT OR UPDATE ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.calculate_warranty_end_date();

-- Add foreign key constraint to expenses table
-- Note: We assume expenses table exists based on the context
-- ALTER TABLE public.purchase_items 
-- ADD CONSTRAINT fk_purchase_items_expense 
-- FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;