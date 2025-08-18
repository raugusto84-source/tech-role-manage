-- Add problem_id to existing diagnostic_questions table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnostic_questions' AND column_name = 'problem_id') THEN
    ALTER TABLE public.diagnostic_questions ADD COLUMN problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update question column name to question_text if needed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnostic_questions' AND column_name = 'question_text') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnostic_questions' AND column_name = 'question') THEN
      ALTER TABLE public.diagnostic_questions RENAME COLUMN question TO question_text;
    ELSE
      ALTER TABLE public.diagnostic_questions ADD COLUMN question_text TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;
END $$;

-- Create diagnostic rules table
CREATE TABLE IF NOT EXISTS public.diagnostic_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
  conditions JSONB NOT NULL,
  recommended_services JSONB,
  confidence_score INTEGER DEFAULT 80,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.diagnostic_rules ENABLE ROW LEVEL SECURITY;

-- Create diagnostic sessions table
CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT,
  problem_id UUID REFERENCES public.problems(id),
  answers JSONB NOT NULL DEFAULT '{}',
  recommended_services JSONB,
  confidence_score INTEGER,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  quote_id UUID REFERENCES public.quotes(id)
);

-- Enable RLS
ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;

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

-- Create remaining indexes
CREATE INDEX IF NOT EXISTS idx_diagnostic_rules_problem_id ON public.diagnostic_rules(problem_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_problem_id ON public.diagnostic_sessions(problem_id);