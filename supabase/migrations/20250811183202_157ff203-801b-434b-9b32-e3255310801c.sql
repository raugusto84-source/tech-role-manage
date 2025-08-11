-- Create table for fiscal withdrawals linked to orders
CREATE TABLE public.fiscal_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  income_id UUID NOT NULL,
  order_id UUID,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  withdrawal_status TEXT NOT NULL DEFAULT 'available', -- 'available' or 'withdrawn'
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  withdrawn_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fiscal_withdrawals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage fiscal withdrawals" 
ON public.fiscal_withdrawals 
FOR ALL 
USING (get_current_user_role() = 'administrador');

-- Create function to auto-create fiscal withdrawal when fiscal income is created
CREATE OR REPLACE FUNCTION public.create_fiscal_withdrawal_on_income()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create withdrawal for fiscal incomes
  IF NEW.account_type = 'fiscal' THEN
    INSERT INTO public.fiscal_withdrawals (
      income_id,
      order_id,
      amount,
      description,
      withdrawal_status
    ) VALUES (
      NEW.id,
      NEW.project_id, -- Assuming project_id links to orders
      NEW.amount,
      'Retiro disponible: ' || NEW.description,
      'available'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-creation
CREATE TRIGGER create_fiscal_withdrawal_trigger
  AFTER INSERT ON public.incomes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_fiscal_withdrawal_on_income();