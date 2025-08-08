-- Create separate survey tables for technician and sales evaluations
CREATE TABLE public.technician_satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  client_id UUID NOT NULL,
  technician_knowledge INTEGER,
  technician_customer_service INTEGER,
  technician_attitude INTEGER,
  technician_comments TEXT,
  overall_recommendation INTEGER,
  general_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for technician surveys
ALTER TABLE public.technician_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Policies for technician surveys
CREATE POLICY "Clients can create surveys for their closed orders"
ON public.technician_satisfaction_surveys
FOR INSERT
WITH CHECK (
  client_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN profiles p ON p.email = c.email
    WHERE o.id = technician_satisfaction_surveys.order_id
    AND o.status = 'finalizada'
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own surveys"
ON public.technician_satisfaction_surveys
FOR SELECT
USING (
  client_id = auth.uid() OR
  get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor'])
);

CREATE POLICY "Staff can view all surveys"
ON public.technician_satisfaction_surveys
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor']));

-- Create sales surveys table
CREATE TABLE public.sales_satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL,
  client_id UUID NOT NULL,
  sales_knowledge INTEGER,
  sales_customer_service INTEGER,
  sales_attitude INTEGER,
  sales_comments TEXT,
  overall_recommendation INTEGER,
  general_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for sales surveys
ALTER TABLE public.sales_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Policies for sales surveys
CREATE POLICY "Clients can create sales surveys for their approved quotes"
ON public.sales_satisfaction_surveys
FOR INSERT
WITH CHECK (
  client_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM quotes q
    JOIN clients c ON c.id = q.client_id
    JOIN profiles p ON p.email = c.email
    WHERE q.id = sales_satisfaction_surveys.quote_id
    AND q.status = 'autorizada'
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own sales surveys"
ON public.sales_satisfaction_surveys
FOR SELECT
USING (
  client_id = auth.uid() OR
  get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor'])
);

CREATE POLICY "Staff can view all sales surveys"
ON public.sales_satisfaction_surveys
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'tecnico', 'vendedor']));

-- Add updated_at triggers
CREATE TRIGGER update_technician_satisfaction_surveys_updated_at
BEFORE UPDATE ON public.technician_satisfaction_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_satisfaction_surveys_updated_at
BEFORE UPDATE ON public.sales_satisfaction_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create functions to automatically generate surveys
CREATE OR REPLACE FUNCTION public.create_technician_survey()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_user_id UUID;
BEGIN
  -- Only create survey when status changes to 'finalizada'
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    -- Get client user_id from client email
    IF NEW.client_id IS NOT NULL THEN
      SELECT p.user_id 
      INTO client_user_id
      FROM public.clients c 
      JOIN public.profiles p ON p.email = c.email
      WHERE c.id = NEW.client_id;
      
      -- Only create survey if we have client user info
      IF client_user_id IS NOT NULL THEN
        INSERT INTO public.technician_satisfaction_surveys (
          order_id,
          client_id
        ) VALUES (
          NEW.id,
          client_user_id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sales_survey()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_user_id UUID;
BEGIN
  -- Only create survey when status changes to 'autorizada'
  IF NEW.status = 'autorizada' AND OLD.status != 'autorizada' THEN
    -- Get client user_id from client email
    IF NEW.client_id IS NOT NULL THEN
      SELECT p.user_id 
      INTO client_user_id
      FROM public.clients c 
      JOIN public.profiles p ON p.email = c.email
      WHERE c.id = NEW.client_id;
      
      -- Only create survey if we have client user info
      IF client_user_id IS NOT NULL THEN
        INSERT INTO public.sales_satisfaction_surveys (
          quote_id,
          client_id
        ) VALUES (
          NEW.id,
          client_user_id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_create_technician_survey
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_technician_survey();

CREATE TRIGGER trigger_create_sales_survey
AFTER UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.create_sales_survey();