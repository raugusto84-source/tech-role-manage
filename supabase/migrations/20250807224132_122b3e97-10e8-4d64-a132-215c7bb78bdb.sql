-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Harden create_satisfaction_survey function (explicit search_path)
CREATE OR REPLACE FUNCTION public.create_satisfaction_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_name_value TEXT;
  client_email_value TEXT;
BEGIN
  -- Only create survey when status changes to 'finalizada'
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    -- Get client information from clients table if client_id exists
    IF NEW.client_id IS NOT NULL THEN
      SELECT c.name, c.email 
      INTO client_name_value, client_email_value
      FROM public.clients c 
      WHERE c.id = NEW.client_id;
      
      -- Only create survey if we have client info
      IF client_name_value IS NOT NULL AND client_email_value IS NOT NULL THEN
        INSERT INTO public.satisfaction_surveys (
          order_id,
          survey_token,
          client_name,
          client_email
        ) VALUES (
          NEW.id,
          public.generate_survey_token(),
          client_name_value,
          client_email_value
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Idempotent trigger creation to ensure required triggers exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_status_log'
  ) THEN
    CREATE TRIGGER trg_orders_status_log
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.log_order_status_change();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_debug_update'
  ) THEN
    CREATE TRIGGER trg_orders_debug_update
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.debug_order_update();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_create_survey'
  ) THEN
    CREATE TRIGGER trg_orders_create_survey
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.create_satisfaction_survey();
  END IF;
END $$;