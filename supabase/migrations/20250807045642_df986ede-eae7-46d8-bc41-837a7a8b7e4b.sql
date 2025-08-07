-- Fix the handle_new_order trigger to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.handle_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Fix the satisfaction survey trigger to check for client_name field existence
CREATE OR REPLACE FUNCTION public.create_satisfaction_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
      FROM clients c 
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