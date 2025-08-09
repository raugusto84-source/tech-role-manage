-- Create a table for multiple taxes per quote item
CREATE TABLE public.quote_item_taxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_item_id UUID NOT NULL REFERENCES public.quote_items(id) ON DELETE CASCADE,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('iva', 'retencion')),
  tax_name TEXT NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for quote_item_taxes
ALTER TABLE public.quote_item_taxes ENABLE ROW LEVEL SECURITY;

-- Admins and sales can manage all quote item taxes
CREATE POLICY "Admins and sales can manage quote item taxes" 
ON public.quote_item_taxes 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));

-- Everyone can view quote item taxes
CREATE POLICY "Everyone can view quote item taxes" 
ON public.quote_item_taxes 
FOR SELECT 
USING (true);

-- Add index for better performance
CREATE INDEX idx_quote_item_taxes_quote_item_id ON public.quote_item_taxes(quote_item_id);