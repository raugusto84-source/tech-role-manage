-- Create table for order process SLAs (Service Level Agreements)
CREATE TABLE public.order_process_slas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE,
  status_stage order_status NOT NULL,
  max_hours INTEGER NOT NULL DEFAULT 24,
  warning_hours INTEGER NOT NULL DEFAULT 18,
  notification_channels TEXT[] DEFAULT '{"whatsapp", "system"}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for tracking order process times
CREATE TABLE public.order_process_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  status_stage order_status NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  hours_elapsed NUMERIC DEFAULT 0,
  sla_status TEXT DEFAULT 'on_time' CHECK (sla_status IN ('on_time', 'warning', 'exceeded')),
  notifications_sent JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for automated notifications log
CREATE TABLE public.automated_notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  tracking_id UUID REFERENCES public.order_process_tracking(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'sla_warning', 'sla_exceeded', 'status_change'
  recipient_type TEXT NOT NULL, -- 'client', 'fleet', 'billing'
  recipient_identifier TEXT NOT NULL, -- email or phone
  message_content TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'whatsapp', 'email', 'system'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_process_slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_process_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_notifications_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_process_slas
CREATE POLICY "Staff can manage order process SLAs"
ON public.order_process_slas FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

CREATE POLICY "Staff can view order process SLAs"
ON public.order_process_slas FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico']));

-- RLS Policies for order_process_tracking
CREATE POLICY "Staff can manage order process tracking"
ON public.order_process_tracking FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

CREATE POLICY "Staff can view order process tracking"
ON public.order_process_tracking FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico']));

-- RLS Policies for automated_notifications_log
CREATE POLICY "Staff can manage automated notifications log"
ON public.automated_notifications_log FOR ALL
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

CREATE POLICY "Staff can view automated notifications log"
ON public.automated_notifications_log FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico']));

-- Function to calculate hours elapsed
CREATE OR REPLACE FUNCTION public.calculate_hours_elapsed()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate hours elapsed based on completion status
  IF NEW.completed_at IS NOT NULL THEN
    NEW.hours_elapsed := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) / 3600.0;
  ELSE
    NEW.hours_elapsed := EXTRACT(EPOCH FROM (now() - NEW.started_at)) / 3600.0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically track order status changes
CREATE OR REPLACE FUNCTION public.track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Complete previous tracking entry if exists
  UPDATE public.order_process_tracking 
  SET completed_at = now(), updated_at = now()
  WHERE order_id = NEW.id 
    AND status_stage = OLD.status 
    AND completed_at IS NULL;
  
  -- Create new tracking entry for new status
  INSERT INTO public.order_process_tracking (
    order_id, 
    status_stage, 
    started_at
  ) VALUES (
    NEW.id, 
    NEW.status, 
    now()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update SLA status based on elapsed time
CREATE OR REPLACE FUNCTION public.update_sla_status()
RETURNS TRIGGER AS $$
DECLARE
  sla_record RECORD;
  new_sla_status TEXT;
BEGIN
  -- Calculate current hours elapsed
  IF NEW.completed_at IS NOT NULL THEN
    NEW.hours_elapsed := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) / 3600.0;
  ELSE
    NEW.hours_elapsed := EXTRACT(EPOCH FROM (now() - NEW.started_at)) / 3600.0;
  END IF;
  
  -- Get SLA configuration for this order's service type and status
  SELECT ops.max_hours, ops.warning_hours
  INTO sla_record
  FROM public.order_process_slas ops
  JOIN public.orders o ON o.service_type = ops.service_type_id
  WHERE o.id = NEW.order_id 
    AND ops.status_stage = NEW.status_stage
    AND ops.is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- Determine SLA status based on elapsed hours
    IF NEW.hours_elapsed >= sla_record.max_hours THEN
      new_sla_status := 'exceeded';
    ELSIF NEW.hours_elapsed >= sla_record.warning_hours THEN
      new_sla_status := 'warning';
    ELSE
      new_sla_status := 'on_time';
    END IF;
    
    -- Update SLA status if changed
    NEW.sla_status := new_sla_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for tracking order status changes
CREATE TRIGGER track_order_status_changes
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.track_order_status_change();

-- Trigger for updating SLA status and hours elapsed
CREATE TRIGGER update_tracking_sla_status
  BEFORE INSERT OR UPDATE ON public.order_process_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sla_status();

-- Insert some default SLA configurations
INSERT INTO public.order_process_slas (service_type_id, status_stage, max_hours, warning_hours, notification_channels) 
SELECT 
  st.id,
  'pendiente'::order_status,
  4, -- 4 hours max for initial response
  2, -- Warning at 2 hours
  '{"whatsapp", "system"}'
FROM public.service_types st 
WHERE st.is_active = true;

INSERT INTO public.order_process_slas (service_type_id, status_stage, max_hours, warning_hours, notification_channels) 
SELECT 
  st.id,
  'en_proceso'::order_status,
  24, -- 24 hours max for processing
  18, -- Warning at 18 hours
  '{"whatsapp", "system"}'
FROM public.service_types st 
WHERE st.is_active = true;

INSERT INTO public.order_process_slas (service_type_id, status_stage, max_hours, warning_hours, notification_channels) 
SELECT 
  st.id,
  'finalizada'::order_status,
  2, -- 2 hours max for closure/billing
  1, -- Warning at 1 hour
  '{"whatsapp", "system"}'
FROM public.service_types st 
WHERE st.is_active = true;