-- Create table for development leads/quotations
CREATE TABLE public.access_development_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  monthly_payment_proposed NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nuevo',
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_description TEXT,
  comments TEXT,
  reminder_date DATE,
  has_investor BOOLEAN DEFAULT false,
  investor_name TEXT,
  investor_amount NUMERIC DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_development_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can manage development leads" ON public.access_development_leads
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('administrador', 'vendedor', 'supervisor')
  )
);

CREATE POLICY "Users can view development leads" ON public.access_development_leads
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_access_development_leads_updated_at
  BEFORE UPDATE ON public.access_development_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();