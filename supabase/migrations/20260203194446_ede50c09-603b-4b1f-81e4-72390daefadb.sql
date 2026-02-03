-- Create system_emails table for configurable email addresses
CREATE TABLE public.system_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL UNIQUE,
  email_address TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_emails ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (needed for edge functions)
CREATE POLICY "Anyone can read system emails" 
ON public.system_emails 
FOR SELECT 
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage system emails" 
ON public.system_emails 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'administrador'
  )
);

-- Insert default values
INSERT INTO public.system_emails (email_type, email_address, description) VALUES
  ('ventas', 'karen.soto@syslag.com', 'Correo de ventas - Recibe notificaciones cuando clientes aceptan cotizaciones'),
  ('facturacion', 'Facturacion@syslag.com', 'Correo de facturación - Recibe notificaciones cuando se completan órdenes');

-- Add trigger for updated_at
CREATE TRIGGER update_system_emails_updated_at
BEFORE UPDATE ON public.system_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();