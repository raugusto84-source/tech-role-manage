-- 1. Hacer client_email nullable en pending_collections
ALTER TABLE public.pending_collections 
ALTER COLUMN client_email DROP NOT NULL;

-- 2. Actualizar el trigger para manejar emails nulos
CREATE OR REPLACE FUNCTION public.create_pending_collection_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create when client_approval changes to true
  IF NEW.client_approval = true AND (OLD.client_approval IS NULL OR OLD.client_approval = false) THEN
    -- Get client info and create pending collection
    INSERT INTO public.pending_collections (
      order_id,
      order_number,
      client_name,
      client_email,
      amount
    )
    SELECT 
      NEW.id,
      NEW.order_number,
      c.name,
      COALESCE(c.email, 'sin-email@pendiente.com'),
      GREATEST(COALESCE(NEW.estimated_cost, 0), 0)
    FROM public.clients c
    WHERE c.id = NEW.client_id
    AND NEW.client_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Crear flotillas iniciales si no existen
INSERT INTO public.fleet_groups (id, name, description, category, is_active, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'Flotilla Sistemas', 'Flotilla especializada en servicios de sistemas, computadoras y redes', 'sistemas', true, now(), now()),
  (gen_random_uuid(), 'Flotilla Seguridad', 'Flotilla especializada en servicios de seguridad, cámaras y accesos', 'seguridad', true, now(), now())
ON CONFLICT DO NOTHING;