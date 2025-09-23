-- C. FOLLOW-UP AUTOMATION: Functions for automatic follow-up integration

-- 1. Function to create automatic follow-up configurations for policy contracts
CREATE OR REPLACE FUNCTION public.create_policy_follow_up_configs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Payment reminder configuration (5 days before due)
  INSERT INTO follow_up_configurations (
    name,
    description,
    trigger_event,
    delay_hours,
    message_template,
    notification_channels,
    is_active
  ) VALUES 
  (
    'Recordatorio de Pago de Póliza',
    'Recordatorio automático 5 días antes del vencimiento del pago',
    'policy_payment_reminder',
    -120, -- 5 days before (negative for before)
    'Estimado {client_name}, le recordamos que su pago de póliza {policy_name} vence el {due_date}. Monto: ${amount}',
    ARRAY['whatsapp', 'email'],
    true
  ),
  (
    'Servicio Programado Próximo',
    'Notificación 24h antes del servicio programado',
    'scheduled_service_reminder',
    -24, -- 24 hours before
    'Hola {client_name}, mañana {service_date} tenemos programado el servicio: {service_description}. Técnico asignado: {technician_name}',
    ARRAY['whatsapp', 'email'],
    true
  ),
  (
    'Técnico en Camino',
    'Notificación cuando el técnico está en camino',
    'technician_on_way',
    0, -- Immediate
    'Su técnico {technician_name} está en camino para el servicio de {service_description}. Tiempo estimado de llegada: {estimated_arrival}',
    ARRAY['whatsapp'],
    true
  ),
  (
    'Encuesta Post-Servicio',
    'Encuesta de satisfacción después del servicio',
    'post_service_survey',
    2, -- 2 hours after completion
    'Gracias por confiar en nosotros. ¿Cómo calificaría el servicio de {technician_name}? Responda con una calificación del 1 al 5.',
    ARRAY['whatsapp', 'email'],
    true
  ),
  (
    'Renovación de Contrato',
    'Recordatorio de renovación 30 días antes del vencimiento',
    'contract_renewal_reminder',
    -720, -- 30 days before
    'Estimado {client_name}, su póliza {policy_name} vence en 30 días. Contáctenos para renovar y mantener sus beneficios.',
    ARRAY['whatsapp', 'email'],
    true
  )
  ON CONFLICT (name) DO NOTHING;

  RAISE LOG 'Policy follow-up configurations created successfully';
END;
$$;

-- 2. Function to trigger follow-ups based on policy events
CREATE OR REPLACE FUNCTION public.trigger_policy_follow_ups(
  p_event_type text,
  p_related_id uuid,
  p_client_email text,
  p_additional_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  config_record RECORD;
  reminder_record RECORD;
  scheduled_time TIMESTAMP WITH TIME ZONE;
  target_user_id uuid;
BEGIN
  -- Get user ID from email
  SELECT user_id INTO target_user_id
  FROM profiles 
  WHERE email = p_client_email
  LIMIT 1;

  -- Find matching follow-up configurations
  FOR config_record IN
    SELECT * FROM follow_up_configurations
    WHERE trigger_event = p_event_type AND is_active = true
  LOOP
    -- Calculate scheduled time
    scheduled_time := now() + (config_record.delay_hours || ' hours')::INTERVAL;
    
    -- Create follow-up reminder
    INSERT INTO follow_up_reminders (
      configuration_id,
      related_id,
      related_type,
      target_user_id,
      target_email,
      scheduled_at,
      status,
      message_content
    ) VALUES (
      config_record.id,
      p_related_id,
      CASE 
        WHEN p_event_type LIKE '%payment%' THEN 'policy_payment'
        WHEN p_event_type LIKE '%service%' THEN 'scheduled_service'
        WHEN p_event_type LIKE '%contract%' THEN 'policy_contract'
        ELSE 'policy_event'
      END,
      target_user_id,
      p_client_email,
      scheduled_time,
      'pending',
      config_record.message_template
    );
  END LOOP;

  RAISE LOG 'Follow-up reminders created for event: %, client: %', p_event_type, p_client_email;
END;
$$;

-- 3. Function to process pending follow-up reminders
CREATE OR REPLACE FUNCTION public.process_pending_follow_ups()
RETURNS TABLE(
  reminder_id uuid,
  client_email text,
  message_content text,
  notification_channels text[],
  processed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reminder_record RECORD;
  config_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Process reminders that are due
  FOR reminder_record IN
    SELECT 
      fr.*,
      fc.notification_channels,
      fc.message_template
    FROM follow_up_reminders fr
    JOIN follow_up_configurations fc ON fc.id = fr.configuration_id
    WHERE fr.status = 'pending'
      AND fr.scheduled_at <= now()
    ORDER BY fr.scheduled_at ASC
    LIMIT 50 -- Process in batches
  LOOP
    -- Update reminder status to processing
    UPDATE follow_up_reminders 
    SET status = 'processing', updated_at = now()
    WHERE id = reminder_record.id;

    -- Return the reminder for processing
    reminder_id := reminder_record.id;
    client_email := reminder_record.target_email;
    message_content := reminder_record.message_content;
    notification_channels := reminder_record.notification_channels;
    processed_count := processed_count + 1;

    RETURN NEXT;
  END LOOP;

  RAISE LOG 'Processed % follow-up reminders', processed_count;
END;
$$;

-- 4. Function to mark follow-up as completed
CREATE OR REPLACE FUNCTION public.complete_follow_up_reminder(p_reminder_id uuid, p_success boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE follow_up_reminders
  SET 
    status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    sent_at = CASE WHEN p_success THEN now() ELSE sent_at END,
    updated_at = now()
  WHERE id = p_reminder_id;

  RAISE LOG 'Follow-up reminder % marked as %', p_reminder_id, CASE WHEN p_success THEN 'completed' ELSE 'failed' END;
END;
$$;

-- Create triggers for automatic follow-up generation

-- Trigger for policy payment reminders
CREATE OR REPLACE FUNCTION public.trigger_policy_payment_follow_ups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a new policy payment is created, set up reminder
  IF TG_OP = 'INSERT' THEN
    PERFORM trigger_policy_follow_ups(
      'policy_payment_reminder',
      NEW.id,
      (SELECT pc.client_email FROM policy_clients pc WHERE pc.id = NEW.policy_client_id),
      jsonb_build_object(
        'amount', NEW.amount,
        'due_date', NEW.due_date,
        'policy_name', (
          SELECT ip.policy_name 
          FROM policy_clients pc 
          JOIN insurance_policies ip ON ip.id = pc.policy_id 
          WHERE pc.id = NEW.policy_client_id
        )
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger for scheduled service reminders
CREATE OR REPLACE FUNCTION public.trigger_scheduled_service_follow_ups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When next service date is updated, set up reminder
  IF TG_OP = 'UPDATE' AND OLD.next_service_date IS DISTINCT FROM NEW.next_service_date THEN
    PERFORM trigger_policy_follow_ups(
      'scheduled_service_reminder',
      NEW.id,
      (SELECT pc.client_email FROM policy_clients pc WHERE pc.id = NEW.policy_client_id),
      jsonb_build_object(
        'service_description', NEW.service_description,
        'service_date', NEW.next_service_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the triggers
CREATE TRIGGER trigger_policy_payment_follow_ups
  AFTER INSERT ON policy_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_policy_payment_follow_ups();

CREATE TRIGGER trigger_scheduled_service_follow_ups
  AFTER UPDATE ON scheduled_services
  FOR EACH ROW
  EXECUTE FUNCTION trigger_scheduled_service_follow_ups();

-- Initialize policy follow-up configurations
SELECT create_policy_follow_up_configs();