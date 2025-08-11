-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  rfc TEXT,
  payment_terms TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can manage suppliers" 
ON public.suppliers 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]));

-- Create purchases table
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_number TEXT NOT NULL DEFAULT '',
  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT NOT NULL,
  concept TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  has_invoice BOOLEAN NOT NULL DEFAULT false,
  invoice_number TEXT,
  account_type account_type NOT NULL DEFAULT 'no_fiscal',
  payment_method TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_id UUID REFERENCES public.expenses(id),
  fiscal_withdrawal_id UUID REFERENCES public.fiscal_withdrawals(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can manage purchases" 
ON public.purchases 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]));

-- Create function to generate purchase number
CREATE OR REPLACE FUNCTION public.generate_purchase_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_year TEXT;
  purchase_count INTEGER;
  purchase_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COUNT(*) + 1 INTO purchase_count
  FROM public.purchases
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  purchase_number := 'COMP-' || current_year || '-' || LPAD(purchase_count::TEXT, 4, '0');
  
  RETURN purchase_number;
END;
$function$;

-- Create trigger to auto-generate purchase number
CREATE OR REPLACE FUNCTION public.handle_new_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.purchase_number IS NULL OR NEW.purchase_number = '' THEN
    NEW.purchase_number := public.generate_purchase_number();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_purchase_number
  BEFORE INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_purchase();