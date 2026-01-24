-- Create quote_status_logs table to track status changes with timestamps
CREATE TABLE public.quote_status_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_quote_status_logs_quote_id ON public.quote_status_logs(quote_id);
CREATE INDEX idx_quote_status_logs_changed_at ON public.quote_status_logs(changed_at);

-- Enable RLS
ALTER TABLE public.quote_status_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view quote status logs" 
ON public.quote_status_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert quote status logs" 
ON public.quote_status_logs 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger function to log status changes
CREATE OR REPLACE FUNCTION public.log_quote_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.quote_status_logs (quote_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on quotes table
CREATE TRIGGER quote_status_change_trigger
AFTER UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.log_quote_status_change();

-- Insert initial status log for existing quotes (backfill)
INSERT INTO public.quote_status_logs (quote_id, previous_status, new_status, changed_at)
SELECT id, NULL, status, created_at
FROM public.quotes
WHERE NOT EXISTS (
  SELECT 1 FROM public.quote_status_logs WHERE quote_id = quotes.id
);