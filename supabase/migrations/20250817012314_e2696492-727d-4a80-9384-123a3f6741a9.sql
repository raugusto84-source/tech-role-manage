-- Create main service categories table for the new system
CREATE TABLE IF NOT EXISTS public.main_service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default main categories
INSERT INTO public.main_service_categories (name, description, icon) VALUES
('Computadora', 'Servicios y productos para computadoras', 'computer'),
('Cámaras', 'Sistemas de videovigilancia y seguridad', 'camera'),
('Control de Acceso', 'Sistemas de control de acceso y biometría', 'key'),
('Fraccionamientos', 'Servicios para desarrollos habitacionales', 'home'),
('Cercas Eléctricas', 'Sistemas de cercado eléctrico y seguridad perimetral', 'zap')
ON CONFLICT DO NOTHING;

-- Create problems table
CREATE TABLE IF NOT EXISTS public.problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.main_service_categories(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create diagnostic questions table
CREATE TABLE IF NOT EXISTS public.diagnostic_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'boolean', -- boolean, multiple_choice, text
  options JSONB, -- For multiple choice questions
  question_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diagnostic rules table (for automatic solution recommendation)
CREATE TABLE IF NOT EXISTS public.diagnostic_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
  conditions JSONB NOT NULL, -- Store answer combinations that trigger this rule
  recommended_services JSONB, -- Array of service_type_ids to recommend
  confidence_score INTEGER DEFAULT 80, -- 0-100 confidence in recommendation
  priority INTEGER DEFAULT 1, -- Higher priority rules are checked first
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create diagnostic sessions table (to store client diagnostic sessions)
CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT,
  problem_id UUID REFERENCES public.problems(id),
  answers JSONB NOT NULL DEFAULT '{}', -- Store all answers
  recommended_services JSONB, -- Store recommended service_type_ids
  confidence_score INTEGER,
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, converted_to_quote
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  quote_id UUID REFERENCES public.quotes(id) -- Link to quote if converted
);

-- Add category_id to service_types if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_types' AND column_name = 'main_category_id') THEN
    ALTER TABLE public.service_types ADD COLUMN main_category_id UUID REFERENCES public.main_service_categories(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.main_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for main_service_categories
CREATE POLICY "Everyone can view active main categories"
ON public.main_service_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage main categories"
ON public.main_service_categories FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for problems
CREATE POLICY "Everyone can view active problems"
ON public.problems FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage problems"
ON public.problems FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for diagnostic_questions
CREATE POLICY "Everyone can view active diagnostic questions"
ON public.diagnostic_questions FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage diagnostic questions"
ON public.diagnostic_questions FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for diagnostic_rules
CREATE POLICY "Everyone can view active diagnostic rules"
ON public.diagnostic_rules FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage diagnostic rules"
ON public.diagnostic_rules FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for diagnostic_sessions
CREATE POLICY "Users can create diagnostic sessions"
ON public.diagnostic_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view their own diagnostic sessions"
ON public.diagnostic_sessions FOR SELECT
USING (
  client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) OR
  get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico'])
);

CREATE POLICY "Staff can manage all diagnostic sessions"
ON public.diagnostic_sessions FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_problems_category_id ON public.problems(category_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_questions_problem_id ON public.diagnostic_questions(problem_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_rules_problem_id ON public.diagnostic_rules(problem_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_problem_id ON public.diagnostic_sessions(problem_id);
CREATE INDEX IF NOT EXISTS idx_service_types_main_category_id ON public.service_types(main_category_id);