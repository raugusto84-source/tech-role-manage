-- Create sales_skills table for managing salesperson skills and knowledge
CREATE TABLE public.sales_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salesperson_id UUID NOT NULL,
  skill_category TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  expertise_level INTEGER NOT NULL DEFAULT 1 CHECK (expertise_level >= 1 AND expertise_level <= 5),
  years_experience INTEGER NOT NULL DEFAULT 0,
  certifications TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.sales_skills ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all sales skills" 
ON public.sales_skills 
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Sales can view their own skills" 
ON public.sales_skills 
FOR SELECT 
USING (
  salesperson_id = auth.uid() OR 
  get_current_user_role() = ANY(ARRAY['administrador'::text, 'vendedor'::text])
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sales_skills_updated_at
BEFORE UPDATE ON public.sales_skills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();