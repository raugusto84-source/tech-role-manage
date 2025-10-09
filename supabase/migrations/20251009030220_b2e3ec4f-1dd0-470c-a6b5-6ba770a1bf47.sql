-- Create sequence for loan numbers first
CREATE SEQUENCE IF NOT EXISTS loans_seq START 1;

-- Create loans table
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  total_months INTEGER NOT NULL,
  start_date DATE NOT NULL,
  payment_day INTEGER NOT NULL CHECK (payment_day >= 1 AND payment_day <= 31),
  account_type TEXT CHECK (account_type IN ('fiscal', 'no_fiscal', 'ninguna')),
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'pagado', 'cancelado')),
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create loan payments table
CREATE TABLE public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  payment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  paid_date DATE,
  account_type TEXT CHECK (account_type IN ('fiscal', 'no_fiscal')),
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado', 'vencido')),
  notes TEXT,
  paid_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loan_id, payment_number)
);

-- Function to generate loan number
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'LOAN-' || LPAD(NEXTVAL('loans_seq')::TEXT, 6, '0');
END;
$$;

-- Trigger to auto-generate loan number
CREATE OR REPLACE FUNCTION set_loan_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.loan_number IS NULL OR NEW.loan_number = '' THEN
    NEW.loan_number := generate_loan_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_loan_number
BEFORE INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION set_loan_number();

-- Enable RLS
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can manage loans"
ON public.loans
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('administrador', 'supervisor', 'vendedor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('administrador', 'supervisor', 'vendedor')
  )
);

CREATE POLICY "Staff can manage loan payments"
ON public.loan_payments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('administrador', 'supervisor', 'vendedor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('administrador', 'supervisor', 'vendedor')
  )
);

-- Function to generate loan payments
CREATE OR REPLACE FUNCTION generate_loan_payments(p_loan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_payment_date DATE;
  v_month INTEGER;
BEGIN
  SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  
  FOR v_month IN 1..v_loan.total_months LOOP
    v_payment_date := (v_loan.start_date + (v_month || ' months')::INTERVAL)::DATE;
    v_payment_date := DATE_TRUNC('month', v_payment_date)::DATE + (v_loan.payment_day - 1);
    
    INSERT INTO public.loan_payments (
      loan_id, payment_number, due_date, amount, status
    ) VALUES (
      p_loan_id, v_month, v_payment_date, v_loan.monthly_payment, 'pendiente'
    );
  END LOOP;
END;
$$;

-- Trigger to update loan status
CREATE OR REPLACE FUNCTION update_loan_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_payments INTEGER;
  v_paid_payments INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pagado')
  INTO v_total_payments, v_paid_payments
  FROM public.loan_payments
  WHERE loan_id = NEW.loan_id;
  
  IF v_paid_payments = v_total_payments THEN
    UPDATE public.loans
    SET status = 'pagado', updated_at = now()
    WHERE id = NEW.loan_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_loan_status_trigger
AFTER UPDATE ON public.loan_payments
FOR EACH ROW
WHEN (NEW.status = 'pagado' AND OLD.status != 'pagado')
EXECUTE FUNCTION update_loan_status();