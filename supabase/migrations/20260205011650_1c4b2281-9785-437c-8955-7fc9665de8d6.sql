-- Create table for lead comments history
CREATE TABLE public.access_development_lead_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.access_development_leads(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.access_development_lead_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Allow all access to lead comments"
ON public.access_development_lead_comments
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_lead_comments_lead_id ON public.access_development_lead_comments(lead_id);
CREATE INDEX idx_lead_comments_created_at ON public.access_development_lead_comments(created_at DESC);