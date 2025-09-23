-- Create policy_payments table for automatic monthly payments
CREATE TABLE IF NOT EXISTS public.policy_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_client_id UUID NOT NULL REFERENCES public.policy_clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'pagado', 'vencido')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create scheduled_services table for periodic services
CREATE TABLE IF NOT EXISTS public.scheduled_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_client_id UUID NOT NULL REFERENCES public.policy_clients(id) ON DELETE CASCADE,
  frequency_days INTEGER NOT NULL DEFAULT 30,
  next_service_date DATE NOT NULL,
  priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create scheduled_service_items table to link services to specific service types
CREATE TABLE IF NOT EXISTS public.scheduled_service_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_service_id UUID NOT NULL REFERENCES public.scheduled_services(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.policy_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_service_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for policy_payments
CREATE POLICY "Staff can manage policy payments"
  ON public.policy_payments
  FOR ALL
  USING (
    get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text])
  );

CREATE POLICY "Clients can view their policy payments"
  ON public.policy_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_clients pc
      JOIN public.clients c ON c.id = pc.client_id
      JOIN public.profiles p ON p.email = c.email
      WHERE pc.id = policy_payments.policy_client_id
      AND p.user_id = auth.uid()
    )
  );

-- RLS policies for scheduled_services  
CREATE POLICY "Staff can manage scheduled services"
  ON public.scheduled_services
  FOR ALL
  USING (
    get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text])
  );

CREATE POLICY "Clients can view their scheduled services"
  ON public.scheduled_services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_clients pc
      JOIN public.clients c ON c.id = pc.client_id
      JOIN public.profiles p ON p.email = c.email
      WHERE pc.id = scheduled_services.policy_client_id
      AND p.user_id = auth.uid()
    )
  );

-- RLS policies for scheduled_service_items
CREATE POLICY "Staff can manage scheduled service items"
  ON public.scheduled_service_items
  FOR ALL
  USING (
    get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text])
  );

CREATE POLICY "Everyone can view scheduled service items"
  ON public.scheduled_service_items
  FOR SELECT
  USING (true);

-- Function to generate monthly payments automatically
CREATE OR REPLACE FUNCTION public.generate_monthly_policy_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  policy_client_record RECORD;
  target_date DATE;
BEGIN
  -- Get the first day of current month
  target_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  -- Generate payments for all active policy clients
  FOR policy_client_record IN 
    SELECT 
      pc.id,
      pc.monthly_fee,
      ip.policy_name
    FROM public.policy_clients pc
    JOIN public.insurance_policies ip ON ip.id = pc.policy_id
    WHERE pc.is_active = true
      AND ip.is_active = true
  LOOP
    -- Check if payment already exists for this month
    IF NOT EXISTS (
      SELECT 1 FROM public.policy_payments 
      WHERE policy_client_id = policy_client_record.id 
      AND due_date = target_date
    ) THEN
      -- Create the monthly payment
      INSERT INTO public.policy_payments (
        policy_client_id,
        amount,
        due_date,
        payment_status
      ) VALUES (
        policy_client_record.id,
        policy_client_record.monthly_fee,
        target_date,
        'pendiente'
      );
    END IF;
  END LOOP;
  
  -- Update overdue payments
  UPDATE public.policy_payments
  SET payment_status = 'vencido'
  WHERE payment_status = 'pendiente'
    AND due_date < CURRENT_DATE;
END;
$function$;

-- Trigger function to create initial payment when assigning policy to client
CREATE OR REPLACE FUNCTION public.create_initial_policy_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create initial payment for the current month
  INSERT INTO public.policy_payments (
    policy_client_id,
    amount,
    due_date,
    payment_status
  ) VALUES (
    NEW.id,
    NEW.monthly_fee,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    'pendiente'
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger for initial payment generation
CREATE TRIGGER create_initial_policy_payment_trigger
  AFTER INSERT ON public.policy_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_policy_payment();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_policy_payments_client_date ON public.policy_payments(policy_client_id, due_date);
CREATE INDEX IF NOT EXISTS idx_policy_payments_status ON public.policy_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_scheduled_services_next_date ON public.scheduled_services(next_service_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_services_client ON public.scheduled_services(policy_client_id);