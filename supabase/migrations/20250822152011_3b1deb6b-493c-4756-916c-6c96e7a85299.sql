-- Create insurance policies table
CREATE TABLE public.insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number TEXT NOT NULL UNIQUE,
  policy_name TEXT NOT NULL,
  description TEXT,
  monthly_fee NUMERIC NOT NULL DEFAULT 0,
  service_discount_percentage NUMERIC DEFAULT 0, -- 0-100
  free_services BOOLEAN DEFAULT false,
  products_generate_cashback BOOLEAN DEFAULT true,
  cashback_percentage NUMERIC DEFAULT 2.0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create policy clients table
CREATE TABLE public.policy_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_id, client_id)
);

-- Create policy payments table
CREATE TABLE public.policy_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_client_id UUID NOT NULL REFERENCES public.policy_clients(id) ON DELETE CASCADE,
  payment_month INTEGER NOT NULL, -- 1-12
  payment_year INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  account_type account_type NOT NULL DEFAULT 'no_fiscal',
  payment_method TEXT,
  due_date DATE NOT NULL,
  payment_date DATE,
  is_paid BOOLEAN DEFAULT false,
  payment_status TEXT DEFAULT 'pendiente', -- pendiente, pagado, vencido
  invoice_number TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_client_id, payment_month, payment_year)
);

-- Create scheduled services table for recurring services
CREATE TABLE public.scheduled_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_client_id UUID NOT NULL REFERENCES public.policy_clients(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id),
  frequency_days INTEGER NOT NULL DEFAULT 30, -- every X days
  next_service_date DATE NOT NULL,
  last_service_date DATE,
  is_active BOOLEAN DEFAULT true,
  service_description TEXT,
  priority INTEGER DEFAULT 1, -- 1 = highest priority
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add policy_id and priority to orders table
ALTER TABLE public.orders 
ADD COLUMN policy_id UUID REFERENCES public.insurance_policies(id),
ADD COLUMN is_policy_order BOOLEAN DEFAULT false,
ADD COLUMN order_priority INTEGER DEFAULT 5; -- 1=highest (policy), 5=normal

-- Create policy order expense tracking
CREATE TABLE public.policy_order_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  policy_client_id UUID NOT NULL REFERENCES public.policy_clients(id),
  expense_month INTEGER NOT NULL,
  expense_year INTEGER NOT NULL,
  service_cost NUMERIC DEFAULT 0,
  product_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_order_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for insurance_policies
CREATE POLICY "Admins can manage policies" ON public.insurance_policies
FOR ALL USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view policies" ON public.insurance_policies
FOR SELECT USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for policy_clients
CREATE POLICY "Admins can manage policy clients" ON public.policy_clients
FOR ALL USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

CREATE POLICY "Staff can view policy clients" ON public.policy_clients
FOR SELECT USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

CREATE POLICY "Clients can view their policy assignment" ON public.policy_clients
FOR SELECT USING (
  client_id IN (
    SELECT c.id FROM clients c 
    JOIN profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  )
);

-- RLS Policies for policy_payments
CREATE POLICY "Admins can manage policy payments" ON public.policy_payments
FOR ALL USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

CREATE POLICY "Staff can view policy payments" ON public.policy_payments
FOR SELECT USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for scheduled_services
CREATE POLICY "Admins can manage scheduled services" ON public.scheduled_services
FOR ALL USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

CREATE POLICY "Staff can view scheduled services" ON public.scheduled_services
FOR SELECT USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico']));

-- RLS Policies for policy_order_expenses
CREATE POLICY "Admins can manage policy expenses" ON public.policy_order_expenses
FOR ALL USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

CREATE POLICY "Staff can view policy expenses" ON public.policy_order_expenses
FOR SELECT USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- Function to generate policy number
CREATE OR REPLACE FUNCTION public.generate_policy_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy_count INTEGER;
  policy_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO policy_count
  FROM public.insurance_policies;
  
  policy_number := 'POL-' || LPAD(policy_count::TEXT, 4, '0');
  
  RETURN policy_number;
END;
$$;

-- Trigger to auto-generate policy number
CREATE OR REPLACE FUNCTION public.handle_new_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.policy_number IS NULL OR NEW.policy_number = '' THEN
    NEW.policy_number := public.generate_policy_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_policy_number
  BEFORE INSERT ON public.insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_policy();

-- Function to process policy orders with special pricing
CREATE OR REPLACE FUNCTION public.process_policy_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy_info RECORD;
  expense_month INTEGER;
  expense_year INTEGER;
  service_total NUMERIC := 0;
  product_total NUMERIC := 0;
BEGIN
  -- Only process if this is a policy order being finalized
  IF NEW.is_policy_order = true AND NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Get policy information
    SELECT ip.*, pc.id as policy_client_id
    INTO policy_info
    FROM public.insurance_policies ip
    JOIN public.policy_clients pc ON pc.policy_id = ip.id
    WHERE ip.id = NEW.policy_id AND pc.client_id = NEW.client_id;
    
    IF policy_info.id IS NOT NULL THEN
      expense_month := EXTRACT(MONTH FROM NEW.created_at);
      expense_year := EXTRACT(YEAR FROM NEW.created_at);
      
      -- Calculate service and product totals
      SELECT 
        COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN oi.item_type = 'producto' THEN oi.total_amount ELSE 0 END), 0)
      INTO service_total, product_total
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id;
      
      -- Record policy expense for reporting
      INSERT INTO public.policy_order_expenses (
        order_id,
        policy_client_id,
        expense_month,
        expense_year,
        service_cost,
        product_cost,
        total_cost
      ) VALUES (
        NEW.id,
        policy_info.policy_client_id,
        expense_month,
        expense_year,
        service_total,
        product_total,
        service_total + product_total
      );
      
      -- Apply cashback only for products if enabled
      IF policy_info.products_generate_cashback AND product_total > 0 THEN
        INSERT INTO public.reward_transactions (
          client_id,
          transaction_type,
          amount,
          description,
          order_id,
          expires_at
        ) VALUES (
          NEW.client_id,
          'earned',
          product_total * (policy_info.cashback_percentage / 100),
          'Cashback póliza ' || policy_info.policy_number || ' - Orden #' || NEW.order_number,
          NEW.id,
          now() + INTERVAL '1 year'
        );
        
        -- Update client rewards
        UPDATE public.client_rewards 
        SET total_cashback = total_cashback + (product_total * (policy_info.cashback_percentage / 100)),
            updated_at = now()
        WHERE client_id = NEW.client_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for policy order processing
CREATE TRIGGER trigger_process_policy_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_policy_order();

-- Function to check overdue policy payments
CREATE OR REPLACE FUNCTION public.update_overdue_policy_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.policy_payments
  SET payment_status = 'vencido'
  WHERE due_date < CURRENT_DATE 
    AND is_paid = false 
    AND payment_status = 'pendiente';
END;
$$;