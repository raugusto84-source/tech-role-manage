-- Add supplier_id to fixed_expenses table
ALTER TABLE public.fixed_expenses 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_supplier_id ON public.fixed_expenses(supplier_id);

COMMENT ON COLUMN public.fixed_expenses.supplier_id IS 'Reference to the supplier for this fixed expense (e.g., water, electricity provider)';