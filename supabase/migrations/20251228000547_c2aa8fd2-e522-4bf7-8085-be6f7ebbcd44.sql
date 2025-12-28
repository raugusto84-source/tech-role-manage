-- Tabla principal de fraccionamientos/contratos de acceso
CREATE TABLE public.access_developments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  
  contract_start_date DATE NOT NULL,
  contract_duration_months INTEGER NOT NULL DEFAULT 12,
  monthly_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_day INTEGER NOT NULL DEFAULT 1 CHECK (payment_day >= 1 AND payment_day <= 28),
  
  service_day INTEGER NOT NULL DEFAULT 15 CHECK (service_day >= 1 AND service_day <= 28),
  auto_generate_orders BOOLEAN DEFAULT true,
  
  has_investor BOOLEAN DEFAULT false,
  investor_name TEXT,
  investor_amount NUMERIC(12,2) DEFAULT 0,
  investor_profit_percent NUMERIC(5,2) DEFAULT 0,
  investor_recovery_months INTEGER DEFAULT 0,
  investor_start_earning_date DATE,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'completed')),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.access_development_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_id UUID NOT NULL REFERENCES public.access_developments(id) ON DELETE CASCADE,
  
  payment_period DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  
  investor_portion NUMERIC(12,2) DEFAULT 0,
  company_portion NUMERIC(12,2) DEFAULT 0,
  is_recovery_period BOOLEAN DEFAULT true,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID,
  payment_method TEXT,
  payment_reference TEXT,
  
  income_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.access_development_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_id UUID NOT NULL REFERENCES public.access_developments(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'completed', 'cancelled')),
  
  generated_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.access_investor_loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_id UUID NOT NULL REFERENCES public.access_developments(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id),
  
  investor_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  profit_percent NUMERIC(5,2) NOT NULL,
  recovery_months INTEGER NOT NULL,
  
  amount_recovered NUMERIC(12,2) DEFAULT 0,
  amount_earned NUMERIC(12,2) DEFAULT 0,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovered', 'earning', 'completed')),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.access_developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_development_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_development_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_investor_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view access developments" ON public.access_developments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage access developments" ON public.access_developments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('administrador', 'vendedor', 'supervisor')
    )
  );

CREATE POLICY "Users can view development payments" ON public.access_development_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage development payments" ON public.access_development_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('administrador', 'vendedor', 'supervisor')
    )
  );

CREATE POLICY "Users can view development orders" ON public.access_development_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage development orders" ON public.access_development_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('administrador', 'vendedor', 'supervisor', 'tecnico')
    )
  );

CREATE POLICY "Users can view investor loans" ON public.access_investor_loans
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage investor loans" ON public.access_investor_loans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('administrador')
    )
  );

CREATE OR REPLACE FUNCTION public.update_access_developments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_access_developments_timestamp
  BEFORE UPDATE ON public.access_developments
  FOR EACH ROW EXECUTE FUNCTION public.update_access_developments_updated_at();

CREATE TRIGGER update_access_development_payments_timestamp
  BEFORE UPDATE ON public.access_development_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_access_developments_updated_at();

CREATE TRIGGER update_access_development_orders_timestamp
  BEFORE UPDATE ON public.access_development_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_access_developments_updated_at();

CREATE TRIGGER update_access_investor_loans_timestamp
  BEFORE UPDATE ON public.access_investor_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_access_developments_updated_at();

CREATE INDEX idx_access_developments_status ON public.access_developments(status);
CREATE INDEX idx_access_development_payments_development ON public.access_development_payments(development_id);
CREATE INDEX idx_access_development_payments_status ON public.access_development_payments(status);
CREATE INDEX idx_access_development_orders_development ON public.access_development_orders(development_id);
CREATE INDEX idx_access_development_orders_scheduled ON public.access_development_orders(scheduled_date);