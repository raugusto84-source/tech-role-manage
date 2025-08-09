-- Create quote_items table to store individual items in quotes
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES public.service_types(id),
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 19.00,
  vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for quote_items
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Admins and sales can manage all quote items
CREATE POLICY "Admins and sales can manage quote items" 
ON public.quote_items 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text]));

-- Clients can view quote items for their own quotes
CREATE POLICY "Clients can view their quote items" 
ON public.quote_items 
FOR SELECT 
USING (
  (get_current_user_role() = 'cliente'::text) AND 
  (EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND q.client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
  ))
);

-- Everyone can view quote items (for general access)
CREATE POLICY "Everyone can view quote items" 
ON public.quote_items 
FOR SELECT 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX idx_quote_items_service_type_id ON public.quote_items(service_type_id);