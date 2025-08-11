-- Create fixed_incomes table for recurring income management
CREATE TABLE public.fixed_incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  account_type account_type NOT NULL DEFAULT 'fiscal',
  payment_method TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 31),
  next_run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_run_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.fixed_incomes ENABLE ROW LEVEL SECURITY;

-- Create policies for fixed_incomes
CREATE POLICY "Admin can view all fixed incomes" 
ON public.fixed_incomes 
FOR SELECT 
USING (get_user_role_safe() = 'administrador');

CREATE POLICY "Admin can insert fixed incomes" 
ON public.fixed_incomes 
FOR INSERT 
WITH CHECK (get_user_role_safe() = 'administrador');

CREATE POLICY "Admin can update fixed incomes" 
ON public.fixed_incomes 
FOR UPDATE 
USING (get_user_role_safe() = 'administrador');

CREATE POLICY "Admin can delete fixed incomes" 
ON public.fixed_incomes 
FOR DELETE 
USING (get_user_role_safe() = 'administrador');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fixed_incomes_updated_at
BEFORE UPDATE ON public.fixed_incomes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_fixed_incomes_next_run_date ON public.fixed_incomes(next_run_date);
CREATE INDEX idx_fixed_incomes_active ON public.fixed_incomes(active);