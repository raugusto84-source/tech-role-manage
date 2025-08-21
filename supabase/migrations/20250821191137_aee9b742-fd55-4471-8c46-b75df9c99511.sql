-- Create survey configurations table
CREATE TABLE public.survey_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  delay_days INTEGER NOT NULL DEFAULT 1,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  survey_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.survey_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage survey configurations"
ON public.survey_configurations
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view survey configurations"
ON public.survey_configurations
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'vendedor', 'tecnico']));

-- Create scheduled surveys table
CREATE TABLE public.scheduled_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  survey_config_id UUID NOT NULL REFERENCES public.survey_configurations(id),
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  survey_token TEXT UNIQUE NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_surveys ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage scheduled surveys"
ON public.scheduled_surveys
FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Clients can view their own scheduled surveys"
ON public.scheduled_surveys
FOR SELECT
USING (client_email = (SELECT email FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can view all scheduled surveys"
ON public.scheduled_surveys
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'vendedor', 'tecnico']));

-- Function to generate survey token
CREATE OR REPLACE FUNCTION public.generate_survey_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(32), 'base64');
  token := replace(replace(replace(token, '+', '-'), '/', '_'), '=', '');
  RETURN token;
END;
$$;

-- Function to schedule survey for order
CREATE OR REPLACE FUNCTION public.schedule_order_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_config RECORD;
  client_info RECORD;
  scheduled_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Only schedule when order is finalized
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Get active survey configuration
    SELECT * INTO active_config
    FROM public.survey_configurations
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Get client information
    SELECT c.name, c.email INTO client_info
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    -- Only proceed if we have both config and client info
    IF active_config.id IS NOT NULL AND client_info.email IS NOT NULL THEN
      
      -- Calculate scheduled date
      scheduled_date := now() + INTERVAL '1 day' * active_config.delay_days + INTERVAL '1 hour' * active_config.delay_hours;
      
      -- Insert scheduled survey
      INSERT INTO public.scheduled_surveys (
        order_id,
        survey_config_id,
        scheduled_date,
        survey_token,
        client_email,
        client_name
      ) VALUES (
        NEW.id,
        active_config.id,
        scheduled_date,
        public.generate_survey_token(),
        client_info.email,
        client_info.name
      );
      
      RAISE LOG 'Survey scheduled for order % on %', NEW.order_number, scheduled_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for scheduling surveys
CREATE TRIGGER schedule_survey_on_order_completion
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_order_survey();

-- Function to process scheduled surveys
CREATE OR REPLACE FUNCTION public.process_scheduled_surveys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  survey_record RECORD;
BEGIN
  -- Get surveys that need to be sent
  FOR survey_record IN 
    SELECT ss.*, sc.name as config_name, sc.survey_questions, o.order_number
    FROM public.scheduled_surveys ss
    JOIN public.survey_configurations sc ON sc.id = ss.survey_config_id
    JOIN public.orders o ON o.id = ss.order_id
    WHERE ss.status = 'scheduled'
    AND ss.scheduled_date <= now()
    AND ss.sent_at IS NULL
  LOOP
    
    -- Mark as sent
    UPDATE public.scheduled_surveys
    SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE id = survey_record.id;
    
    -- Log the survey sending (in production this would trigger email/notification)
    RAISE LOG 'Survey sent for order % to client % (token: %)', 
      survey_record.order_number, 
      survey_record.client_email, 
      survey_record.survey_token;
    
  END LOOP;
END;
$$;

-- Insert default survey configuration
INSERT INTO public.survey_configurations (
  name, 
  description, 
  delay_days, 
  delay_hours,
  survey_questions
) VALUES (
  'Encuesta de Satisfacción Estándar',
  'Encuesta automática que se envía 1 día después de completar una orden',
  1,
  0,
  '[
    {"id": "service_quality", "text": "¿Cómo califica la calidad del servicio recibido?", "type": "rating"},
    {"id": "service_time", "text": "¿Cómo califica la puntualidad del servicio?", "type": "rating"},
    {"id": "would_recommend", "text": "¿Recomendaría nuestros servicios a otros?", "type": "rating"},
    {"id": "general_comments", "text": "Comentarios adicionales (opcional)", "type": "text"}
  ]'::jsonb
);