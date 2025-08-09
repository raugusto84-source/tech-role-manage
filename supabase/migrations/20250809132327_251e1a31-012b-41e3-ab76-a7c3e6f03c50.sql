-- Create table for profit margin configurations
CREATE TABLE public.profit_margin_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_price NUMERIC NOT NULL,
  max_price NUMERIC NOT NULL,
  margin_percentage NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.profit_margin_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage profit margin configs" 
ON public.profit_margin_configs 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view profit margin configs" 
ON public.profit_margin_configs 
FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'vendedor', 'tecnico']));

-- Insert default margin configurations
INSERT INTO public.profit_margin_configs (min_price, max_price, margin_percentage) VALUES
(0, 100, 100),
(101, 199, 100),
(200, 299, 80),
(300, 399, 80),
(400, 499, 70),
(500, 1000, 30),
(1001, 4999, 20),
(5000, 7999, 18),
(8000, 9999, 17),
(10000, 12999, 15);

-- Create trigger for updated_at
CREATE TRIGGER update_profit_margin_configs_updated_at
BEFORE UPDATE ON public.profit_margin_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();