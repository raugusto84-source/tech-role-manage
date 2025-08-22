-- Create policy expenses table to track monthly costs and savings
CREATE TABLE IF NOT EXISTS public.policy_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_client_id UUID NOT NULL,
  order_id UUID,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_name TEXT NOT NULL,
  service_description TEXT,
  original_cost NUMERIC NOT NULL DEFAULT 0, -- What client would have paid without policy
  policy_covered_amount NUMERIC NOT NULL DEFAULT 0, -- What policy covered
  client_paid_amount NUMERIC NOT NULL DEFAULT 0, -- What client paid (if service not fully covered)
  savings_amount NUMERIC NOT NULL DEFAULT 0, -- Total savings (original_cost - client_paid_amount)
  is_covered_by_policy BOOLEAN NOT NULL DEFAULT false, -- If service is included in policy
  month INTEGER NOT NULL, -- Month of the expense (1-12)
  year INTEGER NOT NULL, -- Year of the expense
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  
  -- Add foreign key constraints
  CONSTRAINT fk_policy_expenses_policy_client 
    FOREIGN KEY (policy_client_id) 
    REFERENCES public.policy_clients(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_policy_expenses_order 
    FOREIGN KEY (order_id) 
    REFERENCES public.orders(id) 
    ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.policy_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for policy expenses
CREATE POLICY "Admins can manage policy expenses" 
ON public.policy_expenses 
FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Staff can view policy expenses" 
ON public.policy_expenses 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

CREATE POLICY "Clients can view their policy expenses" 
ON public.policy_expenses 
FOR SELECT 
USING (
  policy_client_id IN (
    SELECT pc.id 
    FROM public.policy_clients pc 
    JOIN public.clients c ON c.id = pc.client_id 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX idx_policy_expenses_policy_client_id ON public.policy_expenses(policy_client_id);
CREATE INDEX idx_policy_expenses_order_id ON public.policy_expenses(order_id);
CREATE INDEX idx_policy_expenses_month_year ON public.policy_expenses(year, month);
CREATE INDEX idx_policy_expenses_service_date ON public.policy_expenses(service_date);

-- Create trigger to automatically update timestamp
CREATE OR REPLACE FUNCTION public.update_policy_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_policy_expenses_updated_at
  BEFORE UPDATE ON public.policy_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_policy_expenses_updated_at();