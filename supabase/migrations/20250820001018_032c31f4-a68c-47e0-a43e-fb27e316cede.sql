-- Fix RLS policies for diagnostic_questions to allow staff to manage them
ALTER TABLE public.diagnostic_questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Anyone can view diagnostic questions" ON public.diagnostic_questions;

-- Create comprehensive policies for diagnostic_questions
CREATE POLICY "Everyone can view active diagnostic questions" 
ON public.diagnostic_questions 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Staff can manage diagnostic questions" 
ON public.diagnostic_questions 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

-- Create diagnostic_flow table for the diagram-like flow
CREATE TABLE public.diagnostic_flow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.main_service_categories(id),
  problem_title TEXT NOT NULL,
  description TEXT,
  flow_data JSONB NOT NULL DEFAULT '{"steps": [], "solutions": []}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for diagnostic_flow
ALTER TABLE public.diagnostic_flow ENABLE ROW LEVEL SECURITY;

-- Create policies for diagnostic_flow
CREATE POLICY "Everyone can view active diagnostic flows" 
ON public.diagnostic_flow 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Staff can manage diagnostic flows" 
ON public.diagnostic_flow 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]));

-- Add indexes for better performance
CREATE INDEX idx_diagnostic_flow_category ON public.diagnostic_flow(category_id);
CREATE INDEX idx_diagnostic_flow_active ON public.diagnostic_flow(is_active);