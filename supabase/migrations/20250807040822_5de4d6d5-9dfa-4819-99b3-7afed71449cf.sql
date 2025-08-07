-- Corregir la función que está causando el error
CREATE OR REPLACE FUNCTION public.create_satisfaction_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Solo crear encuesta cuando el estado cambie a 'finalizada' (que sí existe en el enum)
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    INSERT INTO public.satisfaction_surveys (
      order_id,
      survey_token,
      client_name,
      client_email
    ) VALUES (
      NEW.id,
      public.generate_survey_token(),
      NEW.client_name,
      NEW.client_email
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Agregar campos faltantes a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS requested_date date,
ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS average_service_time integer, -- en minutos
ADD COLUMN IF NOT EXISTS evidence_photos text[]; -- array de URLs de fotos

-- Actualizar valores por defecto para requested_date
UPDATE public.orders 
SET requested_date = delivery_date 
WHERE requested_date IS NULL;