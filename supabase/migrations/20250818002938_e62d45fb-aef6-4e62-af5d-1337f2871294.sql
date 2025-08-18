-- Create problems table
CREATE TABLE IF NOT EXISTS public.problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.main_service_categories(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

-- RLS Policies for problems
CREATE POLICY "Everyone can view active problems"
ON public.problems FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage problems"
ON public.problems FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));