-- Create a table to track order payments
CREATE TABLE public.order_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  payment_amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  account_type account_type NOT NULL DEFAULT 'no_fiscal',
  description TEXT,
  income_id UUID, -- Link to the income record
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all order payments" 
ON public.order_payments 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view order payments" 
ON public.order_payments 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador', 'tecnico', 'vendedor']));

-- Create updated_at trigger
CREATE TRIGGER update_order_payments_updated_at
BEFORE UPDATE ON public.order_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view for pending collections with payment tracking
CREATE OR REPLACE VIEW public.pending_collections_with_payments AS
SELECT 
  pc.id,
  pc.order_number,
  pc.client_name,
  pc.client_email,
  pc.estimated_cost,
  pc.delivery_date,
  pc.status,
  COALESCE(SUM(op.payment_amount), 0) as total_paid,
  (pc.estimated_cost - COALESCE(SUM(op.payment_amount), 0)) as remaining_balance
FROM pending_collections pc
LEFT JOIN order_payments op ON pc.order_number = op.order_number
GROUP BY pc.id, pc.order_number, pc.client_name, pc.client_email, pc.estimated_cost, pc.delivery_date, pc.status
HAVING (pc.estimated_cost - COALESCE(SUM(op.payment_amount), 0)) > 0
ORDER BY pc.delivery_date ASC;